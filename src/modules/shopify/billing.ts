import type { PlanKey, Prisma, SubscriptionStatus } from "@prisma/client";
import { getAppOrigin, getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/security/settings";
import { planLabel } from "@/modules/billing/catalog";
import { loadPlatformPrices, priceForPlan } from "@/modules/billing/platform-prices";
import { listedAmountToCents } from "@/modules/billing/stripe/amounts";
import { shopifyGraphql } from "@/modules/shopify/client";
import { isShopifyPlatform } from "@/modules/platforms/types";

const CREATE_SUBSCRIPTION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
      lineItems: $lineItems
    ) {
      confirmationUrl
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVE_SUBSCRIPTIONS = `#graphql
  query ActiveAppSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        currentPeriodEnd
        trialDays
        test
      }
    }
  }
`;

export type ShopifyActiveSubscription = {
  id: string;
  name: string;
  status: string;
  createdAt?: string;
  currentPeriodEnd?: string | null;
  trialDays?: number | null;
  test?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function listedAmountToShopifyDecimal(amount: string | null | undefined): string | null {
  const cents = listedAmountToCents(amount);
  if (cents == null) return null;
  return (cents / 100).toFixed(2);
}

export function mapShopifySubscriptionStatus(status?: string | null): {
  status: SubscriptionStatus;
  isFree: boolean;
  billingIssue: boolean;
} {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return { status: "ACTIVE", isFree: false, billingIssue: false };
    case "FROZEN":
      return { status: "PAST_DUE", isFree: false, billingIssue: true };
    case "CANCELLED":
    case "CANCELED":
    case "DECLINED":
    case "EXPIRED":
      return { status: "CANCELED", isFree: true, billingIssue: false };
    case "PENDING":
      // Not approved yet — do not unlock a paid seat.
      return { status: "NONE", isFree: true, billingIssue: false };
    default:
      return { status: "NONE", isFree: true, billingIssue: false };
  }
}

export function parsePlanKeyFromSubscriptionName(name?: string | null): Extract<PlanKey, "STARTER" | "GROWTH" | "PRO"> | null {
  if (!name) return null;
  const upper = name.toUpperCase();
  if (upper.includes("PRO")) return "PRO";
  if (upper.includes("BUSINESS") || upper.includes("GROWTH")) return "GROWTH";
  if (upper.includes("STARTER")) return "STARTER";
  return null;
}

export async function getShopifyShopCredentials(siteId: string) {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
  });
  if (!site || !isShopifyPlatform(site.platform) || !site.shopifyShopDomain) {
    return null;
  }
  const { getValidShopifyAccessToken } = await import("@/modules/shopify/tokens");
  const creds = await getValidShopifyAccessToken(siteId);
  if (!creds) return null;
  return {
    site,
    shop: creds.shop,
    accessToken: creds.accessToken,
    organizationId: site.organizationId,
  };
}

async function useTestCharges() {
  const configured = await getSetting("shopify_billing_test", "");
  if (configured === "true") return true;
  if (configured === "false") return false;
  return getEnv().NODE_ENV !== "production";
}

/**
 * Start a Shopify App Subscription (native Billing API). Returns the merchant confirmation URL.
 */
export async function createShopifyBillingConfirmation(input: {
  organizationId: string;
  siteId: string;
  planKey: Extract<PlanKey, "STARTER" | "GROWTH" | "PRO">;
}) {
  const creds = await getShopifyShopCredentials(input.siteId);
  if (!creds || creds.organizationId !== input.organizationId) {
    throw new Error("Shopify store credentials are missing. Reconnect the app.");
  }

  const [prices, trialDaysRaw] = await Promise.all([
    loadPlatformPrices("SHOPIFY"),
    getSetting("plan_trial_days", "7"),
  ]);
  const listed = priceForPlan(prices, input.planKey);
  const amount = listedAmountToShopifyDecimal(listed);
  if (!amount) {
    throw new Error("Set Shopify Starter / Business / Pro prices in Admin → Settings.");
  }

  const trialDays = Math.max(0, Number(trialDaysRaw) || 0);
  const origin = getAppOrigin();
  const returnUrl = `${origin}/api/billing/shopify/callback?plan=${input.planKey}&siteId=${encodeURIComponent(input.siteId)}`;
  const name = `tidyAgent ${planLabel(input.planKey)}`;
  const test = await useTestCharges();

  const data = await shopifyGraphql<{
    appSubscriptionCreate?: {
      confirmationUrl?: string | null;
      appSubscription?: { id?: string; status?: string } | null;
      userErrors?: Array<{ message?: string }>;
    };
  }>(creds.shop, creds.accessToken, CREATE_SUBSCRIPTION, {
    name,
    returnUrl,
    trialDays: trialDays > 0 ? trialDays : null,
    test,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount, currencyCode: (prices.currency || "USD").toUpperCase() },
            interval: "EVERY_30_DAYS",
          },
        },
      },
    ],
  });

  const payload = data.appSubscriptionCreate;
  const errors = payload?.userErrors?.map((e) => e.message).filter(Boolean) ?? [];
  if (errors.length || !payload?.confirmationUrl) {
    throw new Error(errors.join("; ") || "Shopify did not return a billing confirmation URL.");
  }

  if (payload.appSubscription?.id) {
    const current = await prisma.subscription.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
    });
    if (current) {
      await prisma.subscription.update({
        where: { id: current.id },
        data: {
          billingProvider: "SHOPIFY",
          shopifySubscriptionId: payload.appSubscription.id,
          rawBilling: payload as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  return { confirmationUrl: payload.confirmationUrl, subscriptionId: payload.appSubscription?.id ?? null };
}

export async function fetchShopifyActiveSubscriptions(shop: string, accessToken: string) {
  const data = await shopifyGraphql<{
    currentAppInstallation?: { activeSubscriptions?: ShopifyActiveSubscription[] };
  }>(shop, accessToken, ACTIVE_SUBSCRIPTIONS);
  return data.currentAppInstallation?.activeSubscriptions ?? [];
}

export async function syncShopifyBillingFromShop(input: {
  organizationId: string;
  siteId: string;
  preferredPlanKey?: Extract<PlanKey, "STARTER" | "GROWTH" | "PRO"> | null;
}) {
  const creds = await getShopifyShopCredentials(input.siteId);
  if (!creds || creds.organizationId !== input.organizationId) {
    throw new Error("Shopify store credentials are missing.");
  }

  const active = await fetchShopifyActiveSubscriptions(creds.shop, creds.accessToken);
  const preferred =
    (input.preferredPlanKey &&
      active.find((sub) => parsePlanKeyFromSubscriptionName(sub.name) === input.preferredPlanKey)) ||
    active.find((sub) => (sub.status || "").toUpperCase() === "ACTIVE") ||
    active[0];

  if (!preferred) {
    await applyShopifySubscriptionState({
      organizationId: input.organizationId,
      planKey: "FREE",
      status: "NONE",
      isFree: true,
      shopifySubscriptionId: null,
      autoRenewing: false,
      cancelAtPeriodEnd: false,
    });
    return { planKey: "FREE" as const, status: "NONE" as const };
  }

  const mapped = mapShopifySubscriptionStatus(preferred.status);
  const planKey =
    parsePlanKeyFromSubscriptionName(preferred.name) ||
    input.preferredPlanKey ||
    ("STARTER" as const);

  const trialDays = preferred.trialDays ?? 0;
  const createdAt = preferred.createdAt ? new Date(preferred.createdAt) : null;
  const trialEndsAt =
    trialDays > 0 && createdAt
      ? new Date(createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : null;
  const inTrial = Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now() && !mapped.isFree);

  await applyShopifySubscriptionState({
    organizationId: input.organizationId,
    planKey: mapped.isFree ? "FREE" : planKey,
    status: inTrial ? "TRIALING" : mapped.status,
    isFree: mapped.isFree,
    billingIssue: mapped.billingIssue,
    shopifySubscriptionId: preferred.id,
    billingCycle: "MONTHLY",
    autoRenewing: !mapped.isFree,
    trialEndsAt,
    currentPeriodEnd: preferred.currentPeriodEnd ? new Date(preferred.currentPeriodEnd) : null,
    rawBilling: preferred as unknown as Prisma.InputJsonValue,
  });

  return { planKey: mapped.isFree ? "FREE" : planKey, status: inTrial ? "TRIALING" : mapped.status };
}

export async function applyShopifySubscriptionState(input: {
  organizationId: string;
  planKey: PlanKey;
  status: SubscriptionStatus;
  isFree: boolean;
  shopifySubscriptionId?: string | null;
  billingCycle?: string | null;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  autoRenewing?: boolean;
  canceledAt?: Date | null;
  billingIssue?: boolean;
  cancelReason?: string | null;
  rawBilling?: Prisma.InputJsonValue;
}) {
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
    billingProvider: "SHOPIFY" as const,
    billingCycle: input.billingCycle ?? "MONTHLY",
    trialEndsAt: input.trialEndsAt ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    autoRenewing: input.autoRenewing ?? !input.cancelAtPeriodEnd,
    canceledAt: input.canceledAt ?? null,
    cancelReason: input.cancelReason ?? null,
    billingIssue: Boolean(input.billingIssue),
    shopifySubscriptionId:
      input.shopifySubscriptionId !== undefined
        ? input.shopifySubscriptionId
        : (current?.shopifySubscriptionId ?? null),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    rawBilling: input.rawBilling ?? undefined,
  };

  if (current) {
    return prisma.subscription.update({ where: { id: current.id }, data });
  }
  return prisma.subscription.create({
    data: { organizationId: input.organizationId, ...data },
  });
}

/** Handle APP_SUBSCRIPTIONS_UPDATE / app_subscriptions/update webhook for one shop. */
export async function handleShopifySubscriptionWebhook(shopDomain: string, payload: Record<string, unknown>) {
  const site = await prisma.wixSite.findFirst({
    where: { platform: "SHOPIFY", shopifyShopDomain: shopDomain },
  });
  if (!site) return { ok: true as const, found: false };

  const nested = asRecord(payload.app_subscription);
  const status = String(nested.status ?? payload.status ?? "");
  const gid = String(nested.admin_graphql_api_id ?? nested.id ?? payload.admin_graphql_api_id ?? "");
  const name = String(nested.name ?? payload.name ?? "");
  const mapped = mapShopifySubscriptionStatus(status);
  const planKey = parsePlanKeyFromSubscriptionName(name) || "STARTER";

  await applyShopifySubscriptionState({
    organizationId: site.organizationId,
    planKey: mapped.isFree ? "FREE" : planKey,
    status: mapped.status,
    isFree: mapped.isFree,
    billingIssue: mapped.billingIssue,
    shopifySubscriptionId: gid || null,
    autoRenewing: !mapped.isFree,
    cancelAtPeriodEnd: mapped.isFree,
    canceledAt: mapped.isFree ? new Date() : null,
    cancelReason: mapped.isFree ? `shopify_${status.toLowerCase() || "update"}` : null,
    rawBilling: payload as Prisma.InputJsonValue,
  });

  // Prefer live GraphQL state when we still have a token.
  try {
    await syncShopifyBillingFromShop({
      organizationId: site.organizationId,
      siteId: site.id,
      preferredPlanKey: mapped.isFree ? null : planKey,
    });
  } catch {
    /* webhook payload already applied */
  }

  return { ok: true as const, found: true };
}
