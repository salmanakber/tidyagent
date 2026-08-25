import type { PlanKey } from "@prisma/client";
import { getAppOrigin } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { planLabel } from "@/modules/billing/catalog";
import { loadPlatformPrices, priceForPlan } from "@/modules/billing/platform-prices";
import { getSetting } from "@/lib/security/settings";
import { listedAmountToCents, normalizeStripeCurrency } from "@/modules/billing/stripe/amounts";
import { getStripeClient } from "@/modules/billing/stripe/client";
import { assertPaidPlanKey } from "@/modules/billing/stripe/apply";
import { isWixPlatform, platformLabel, resolveSitePlatform, type SitePlatform } from "@/modules/platforms/types";

export type StripeCheckoutInput = {
  organizationId: string;
  siteId: string;
  platform: SitePlatform | string | null | undefined;
  planKey: PlanKey;
  email?: string | null;
  name?: string | null;
};

/**
 * Create a Stripe Checkout Session for Webflow (and other non-Wix) seats.
 * Prices come from Admin listed packages — no Stripe Price IDs required.
 */
export async function createStripeCheckoutSession(input: StripeCheckoutInput) {
  const platform = resolveSitePlatform(input.platform);
  if (isWixPlatform(platform)) {
    throw new Error("Wix checkout stays on Wix App Market.");
  }
  assertPaidPlanKey(input.planKey);

  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured. Add the secret key in Admin → Settings.");
  }

  const [prices, trialDaysRaw, subscription, site] = await Promise.all([
    loadPlatformPrices(platform),
    getSetting("plan_trial_days", "7"),
    prisma.subscription.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wixSite.findFirst({
      where: { id: input.siteId, organizationId: input.organizationId },
      select: { displayName: true, url: true, platform: true },
    }),
  ]);

  if (!site || site.platform === "WIX") {
    throw new Error("Stripe checkout is only for non-Wix sites.");
  }

  const listed = priceForPlan(prices, input.planKey);
  const cents = listedAmountToCents(listed);
  if (!cents) {
    throw new Error(`Set a ${platformLabel(platform)} ${planLabel(input.planKey)} price in Admin → Settings.`);
  }

  const trialDays = Math.max(0, Number(trialDaysRaw) || 0);
  const origin = getAppOrigin();
  const currency = normalizeStripeCurrency(prices.currency);
  const metadata = {
    organizationId: input.organizationId,
    siteId: input.siteId,
    planKey: input.planKey,
    platform,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${origin}/billing?stripe=success`,
    cancel_url: `${origin}/billing?stripe=cancel`,
    client_reference_id: input.organizationId,
    customer: subscription?.stripeCustomerId || undefined,
    customer_email: subscription?.stripeCustomerId ? undefined : input.email || undefined,
    metadata,
    subscription_data: {
      metadata,
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: cents,
          recurring: { interval: "month" },
          product_data: {
            name: `tidyAgent ${planLabel(input.planKey)}`,
            description: `${platformLabel(platform)} plan for ${site.displayName || site.url || "your site"}`,
          },
        },
      },
    ],
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { url: session.url, sessionId: session.id };
}

export async function createStripeBillingPortalSession(input: {
  organizationId: string;
  email?: string | null;
}) {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription?.stripeCustomerId) {
    throw new Error("No Stripe customer on this workspace yet.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${getAppOrigin()}/billing`,
  });

  return { url: session.url };
}
