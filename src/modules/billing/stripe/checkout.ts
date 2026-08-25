import type { PlanKey } from "@prisma/client";
import { getAppOrigin } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { planLabel } from "@/modules/billing/catalog";
import { loadPlatformPrices, priceForPlan } from "@/modules/billing/platform-prices";
import { getSetting } from "@/lib/security/settings";
import { listedAmountToCents, normalizeStripeCurrency } from "@/modules/billing/stripe/amounts";
import { getStripeClient } from "@/modules/billing/stripe/client";
import { assertPaidPlanKey } from "@/modules/billing/stripe/apply";
import { isWebflowPlatform, isWixPlatform, platformLabel, resolveSitePlatform, type SitePlatform } from "@/modules/platforms/types";

export type StripeCheckoutInput = {
  organizationId: string;
  siteId: string;
  platform: SitePlatform | string | null | undefined;
  planKey: PlanKey;
  email?: string | null;
  name?: string | null;
};

/**
 * Create a card Checkout Session for Webflow seats only.
 * Wix stays on Wix App Market; Shopify uses Shopify Billing API.
 */
export async function createStripeCheckoutSession(input: StripeCheckoutInput) {
  const platform = resolveSitePlatform(input.platform);
  if (isWixPlatform(platform)) {
    throw new Error("Wix checkout stays on Wix App Market.");
  }
  if (!isWebflowPlatform(platform)) {
    throw new Error("Card checkout is only for Webflow sites.");
  }
  assertPaidPlanKey(input.planKey);

  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Card checkout is not configured. Add payment keys in Admin → Settings.");
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

  if (!site || site.platform !== "WEBFLOW") {
    throw new Error("Card checkout is only for Webflow sites.");
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

  // tax_code = SaaS (required when Managed Payments is on). Also opt out of Managed Payments
  // so classic subscription checkout works on accounts that enable it by default.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancel`,
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
            tax_code: "txcd_10103001",
          },
        },
      },
    ],
    allow_promotion_codes: true,
    managed_payments: { enabled: false },
  } as Parameters<typeof stripe.checkout.sessions.create>[0]);

  if (!session.url) {
    throw new Error("Checkout did not return a payment URL.");
  }

  return { url: session.url, sessionId: session.id };
}

export async function createStripeBillingPortalSession(input: {
  organizationId: string;
  email?: string | null;
}) {
  const stripe = await getStripeClient();
  if (!stripe) {
    throw new Error("Card billing is not configured.");
  }

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: input.organizationId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription?.stripeCustomerId) {
    throw new Error("No billing customer on this workspace yet.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${getAppOrigin()}/billing`,
  });

  return { url: session.url };
}
