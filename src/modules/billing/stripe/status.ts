import type { PlanKey, SubscriptionStatus } from "@prisma/client";

const PAID_PLANS = new Set(["STARTER", "GROWTH", "PRO"]);

export function parseStripePlanKey(value?: string | null): Extract<PlanKey, "STARTER" | "GROWTH" | "PRO"> | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (upper === "BUSINESS") return "GROWTH";
  if (upper === "STARTER" || upper === "GROWTH" || upper === "PRO") return upper;
  return null;
}

export function mapStripeSubscriptionStatus(
  stripeStatus: string | null | undefined,
  cancelAtPeriodEnd?: boolean,
): { status: SubscriptionStatus; isFree: boolean; billingIssue: boolean; cancelAtPeriodEnd: boolean } {
  const cancel = Boolean(cancelAtPeriodEnd);
  switch (stripeStatus) {
    case "trialing":
      return { status: "TRIALING", isFree: false, billingIssue: false, cancelAtPeriodEnd: cancel };
    case "active":
      return { status: "ACTIVE", isFree: false, billingIssue: false, cancelAtPeriodEnd: cancel };
    case "past_due":
    case "unpaid":
      return { status: "PAST_DUE", isFree: false, billingIssue: true, cancelAtPeriodEnd: cancel };
    case "canceled":
    case "incomplete_expired":
      return { status: "CANCELED", isFree: true, billingIssue: false, cancelAtPeriodEnd: false };
    case "incomplete":
      return { status: "NONE", isFree: true, billingIssue: false, cancelAtPeriodEnd: false };
    default:
      return { status: "NONE", isFree: true, billingIssue: false, cancelAtPeriodEnd: cancel };
  }
}

export function isPaidStripePlan(planKey: PlanKey) {
  return PAID_PLANS.has(planKey);
}
