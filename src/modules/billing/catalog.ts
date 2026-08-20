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
    "1 general agent (greeting + human handoff)",
    "Classic chat widget",
    "Wix site profile, pages, and CMS (no store catalog)",
    "Greeting, follow-up, and human-handoff automations",
    "1,000 conversations / month",
    "250 knowledge pages",
  ],
  GROWTH: [
    "Everything in Starter",
    "Up to 4 agents with specialist routing",
    "All four widget looks (Classic, Atelier, Dock, Noir)",
    "Wix Stores catalog, CMS, and bookings data",
    "Store help, lead capture, and after-hours automations",
    "5,000 conversations / month",
    "1,000 knowledge pages",
  ],
  PRO: [
    "Everything in Business",
    "Up to 8 agents",
    "Spoken replies (Google Cloud TTS, Amazon Polly fallback)",
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

/** Opens Wix site selector, then the installed app, so we get a fresh signed instance. */
export function wixReconnectUrl() {
  const appId = process.env.WIX_APP_ID;
  if (!appId) return "https://manage.wix.com/";
  const actionUrl = `https://www.wix.com/dashboard/{{metaSiteId}}/app/${appId}`;
  const params = new URLSearchParams({
    title: "Select a site to open tidyAgent",
    buttonText: "Open tidyAgent",
    autoSelectOnSingleSite: "true",
    actionUrl,
  });
  return `https://www.wix.com/my-account/site-selector/?${params.toString()}`;
}

export function wixInstallUrl() {
  const appId = process.env.WIX_APP_ID;
  if (!appId) return null;
  return `https://www.wix.com/app-market/add-app/${appId}`;
}

export function wixProductIdForPlan(planKey: PlanKey) {
  return catalogFromEnv()[planKey] || null;
}
