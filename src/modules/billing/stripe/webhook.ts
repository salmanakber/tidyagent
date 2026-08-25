import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyStripeSubscriptionState, clearStripePaidSeat } from "@/modules/billing/stripe/apply";
import { mapStripeSubscriptionStatus, parseStripePlanKey } from "@/modules/billing/stripe/status";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function unixToDate(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000);
}

async function organizationIdFromSubscription(sub: Stripe.Subscription) {
  const fromMeta = asString(sub.metadata?.organizationId);
  if (fromMeta) return fromMeta;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  const row = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    orderBy: { createdAt: "desc" },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}

async function applyFromStripeSubscription(sub: Stripe.Subscription, fallbackPlanKey?: string | null) {
  const organizationId = await organizationIdFromSubscription(sub);
  if (!organizationId) {
    console.warn("Stripe subscription event missing organizationId", sub.id);
    return;
  }

  const mapped = mapStripeSubscriptionStatus(sub.status, sub.cancel_at_period_end);
  const planKey =
    parseStripePlanKey(sub.metadata?.planKey) ||
    parseStripePlanKey(fallbackPlanKey) ||
    (mapped.isFree ? "FREE" : "STARTER");

  if (mapped.isFree && (sub.status === "canceled" || sub.status === "incomplete_expired")) {
    await clearStripePaidSeat(organizationId, `stripe_${sub.status}`);
    await prisma.subscription.updateMany({
      where: { organizationId },
      data: {
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: null,
      },
    });
    return;
  }

  await applyStripeSubscriptionState({
    organizationId,
    planKey: mapped.isFree ? "FREE" : planKey,
    status: mapped.status,
    isFree: mapped.isFree,
    billingIssue: mapped.billingIssue,
    cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
    autoRenewing: !mapped.cancelAtPeriodEnd && !mapped.isFree,
    trialEndsAt: unixToDate(sub.trial_end),
    currentPeriodEnd: unixToDate(sub.current_period_end),
    canceledAt: mapped.cancelAtPeriodEnd || mapped.isFree ? unixToDate(sub.canceled_at) ?? new Date() : null,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    billingCycle: "MONTHLY",
    rawBilling: sub as unknown as Prisma.InputJsonValue,
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = asString(session.metadata?.organizationId) || asString(session.client_reference_id);
  const planKey = parseStripePlanKey(session.metadata?.planKey);
  if (!organizationId || !planKey) {
    console.warn("Stripe checkout.session.completed missing metadata", session.id);
    return;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  // Soft-unlock immediately; subscription.updated / retrieved details refine period dates.
  await applyStripeSubscriptionState({
    organizationId,
    planKey,
    status: session.payment_status === "paid" || !session.payment_status ? "ACTIVE" : "TRIALING",
    isFree: false,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    billingCycle: "MONTHLY",
    autoRenewing: true,
    cancelAtPeriodEnd: false,
    billingIssue: false,
    rawBilling: session as unknown as Prisma.InputJsonValue,
  });

  // Prefer TRIALING when Stripe still has a trial (payment_status can be unpaid during trial).
  if (subscriptionId) {
    try {
      const { getStripeClient } = await import("@/modules/billing/stripe/client");
      const stripe = await getStripeClient();
      const sub = await stripe?.subscriptions.retrieve(subscriptionId);
      if (sub) await applyFromStripeSubscription(sub, planKey);
    } catch (error) {
      console.error("Could not refresh Stripe subscription after checkout", error);
    }
  }
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applyFromStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (!subscriptionId) break;
      const row = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
        orderBy: { createdAt: "desc" },
      });
      if (!row || row.planKey === "FREE") break;
      await applyStripeSubscriptionState({
        organizationId: row.organizationId,
        planKey: row.planKey,
        status: "PAST_DUE",
        isFree: false,
        billingIssue: true,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        autoRenewing: row.autoRenewing,
        trialEndsAt: row.trialEndsAt,
        currentPeriodEnd: row.currentPeriodEnd,
        stripeCustomerId: row.stripeCustomerId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        billingCycle: row.billingCycle,
      });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (!subscriptionId) break;
      try {
        const { getStripeClient } = await import("@/modules/billing/stripe/client");
        const stripe = await getStripeClient();
        const sub = await stripe?.subscriptions.retrieve(subscriptionId);
        if (sub) await applyFromStripeSubscription(sub);
      } catch (error) {
        console.error("Could not refresh Stripe subscription after invoice.paid", error);
      }
      break;
    }
    default:
      break;
  }
}
