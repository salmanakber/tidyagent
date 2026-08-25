import type { PlanKey, Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPaidStripePlan } from "@/modules/billing/stripe/status";

export type ApplyStripeSubscriptionInput = {
  organizationId: string;
  planKey: PlanKey;
  status: SubscriptionStatus;
  isFree: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingCycle?: string | null;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  autoRenewing?: boolean;
  canceledAt?: Date | null;
  billingIssue?: boolean;
  cancelReason?: string | null;
  rawBilling?: Prisma.InputJsonValue;
};

/**
 * Upsert the Stripe-backed subscription row for a non-Wix organization.
 * Never writes billingProvider WIX and never touches Wix webhook paths.
 */
export async function applyStripeSubscriptionState(input: ApplyStripeSubscriptionInput) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { key: input.planKey } });
  const current = await prisma.subscription.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const data = {
    planId: plan.id,
    planKey: input.planKey,
    status: input.status,
    isFree: input.isFree,
    billingProvider: "STRIPE" as const,
    billingCycle: input.billingCycle ?? "MONTHLY",
    trialEndsAt: input.trialEndsAt ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    autoRenewing: input.autoRenewing ?? !input.cancelAtPeriodEnd,
    canceledAt: input.canceledAt ?? null,
    cancelReason: input.cancelReason ?? null,
    billingIssue: Boolean(input.billingIssue),
    stripeCustomerId:
      input.stripeCustomerId !== undefined ? input.stripeCustomerId : (current?.stripeCustomerId ?? null),
    stripeSubscriptionId:
      input.stripeSubscriptionId !== undefined
        ? input.stripeSubscriptionId
        : (current?.stripeSubscriptionId ?? null),
    rawBilling: input.rawBilling ?? undefined,
  };

  if (current) {
    return prisma.subscription.update({ where: { id: current.id }, data });
  }

  return prisma.subscription.create({
    data: {
      organizationId: input.organizationId,
      ...data,
    },
  });
}

export async function clearStripePaidSeat(organizationId: string, reason?: string) {
  return applyStripeSubscriptionState({
    organizationId,
    planKey: "FREE",
    status: "CANCELED",
    isFree: true,
    cancelAtPeriodEnd: false,
    autoRenewing: false,
    canceledAt: new Date(),
    cancelReason: reason ?? "stripe_canceled",
    billingIssue: false,
    stripeSubscriptionId: null,
  });
}

export function assertPaidPlanKey(planKey: PlanKey): asserts planKey is Extract<PlanKey, "STARTER" | "GROWTH" | "PRO"> {
  if (!isPaidStripePlan(planKey)) {
    throw new Error(`Plan ${planKey} is not a paid Stripe package.`);
  }
}
