import type { PlanKey } from "@prisma/client";

function catalogFromEnv(): Partial<Record<PlanKey, string>> {
  return {
    STARTER: process.env.WIX_VENDOR_PRODUCT_STARTER || undefined,
    GROWTH: process.env.WIX_VENDOR_PRODUCT_BUSINESS || process.env.WIX_VENDOR_PRODUCT_GROWTH || undefined,
    PRO: process.env.WIX_VENDOR_PRODUCT_PRO || undefined,
  };
}

export function wixPlanCatalog() {
  return catalogFromEnv();
}

export const PLAN_LABELS: Record<PlanKey, string> = {
  FREE: "Free",
  STARTER: "Starter",
  GROWTH: "Business",
  PRO: "Pro",
};

export function planLabel(key: PlanKey) {
  return PLAN_LABELS[key];
}

/** What each paid package is allowed to do. Wix permissions stay app-wide; we gate here. */
export const PLAN_SCOPES: Record<PlanKey, string[]> = {
  FREE: [
    "Install on a Wix site",
    "Choose Starter, Business, or Pro to unlock the dashboard and live widget",
  ],
  STARTER: [
    "7-day free trial",
    "Live chat widget on every published page",
    "Wix site profile, pages, and CMS (no store catalog)",
    "Domain crawl of the live website",
    "Human handoff when the AI is unsure",
    "Basic automations (greeting, handoff, follow-up)",
    "1,000 conversations / month",
    "250 knowledge pages",
  ],
  GROWTH: [
    "Everything in Starter",
    "7-day free trial",
    "Wix Stores catalog, CMS, and bookings data",
    "Product search, cart help, order tracking",
    "Full automations for support and sales",
    "5,000 conversations / month",
    "1,000 knowledge pages",
  ],
  PRO: [
    "Everything in Business",
    "7-day free trial",
    "Deepest Wix API + domain crawl",
    "Voice conversations",
    "Highest limits for busy stores",
    "25,000 conversations / month",
    "5,000 knowledge pages",
    "Priority-ready capacity for peak traffic",
  ],
};

/**
 * vendorProductId (instance/webhooks) and packageName (Get App Instance)
 * are the same Wix plan identifier from the app dashboard Pricing page.
 */
export function mapWixPackageToPlan(packageName?: string | null): PlanKey {
  if (!packageName) return "FREE";
  const catalog = catalogFromEnv();
  for (const [key, id] of Object.entries(catalog) as [PlanKey, string | undefined][]) {
    if (id && (id === packageName || id.toLowerCase() === packageName.toLowerCase())) return key;
  }
  const value = packageName.toLowerCase();
  if (value.includes("pro")) return "PRO";
  if (value.includes("business") || value.includes("growth") || value.includes("plus")) {
    return "GROWTH";
  }
  if (value.includes("starter") || value.includes("basic") || value.includes("beginner")) {
    return "STARTER";
  }
  return "FREE";
}

/** Wix-hosted upgrade page — payments stay in Wix, never Stripe. */
export function wixUpgradeUrl(instanceId: string) {
  const appId = process.env.WIX_APP_ID;
  if (!appId) return null;
  return `https://www.wix.com/apps/upgrade/${appId}?appInstanceId=${encodeURIComponent(instanceId)}`;
}

export function wixProductIdForPlan(planKey: PlanKey) {
  return catalogFromEnv()[planKey] || null;
}
