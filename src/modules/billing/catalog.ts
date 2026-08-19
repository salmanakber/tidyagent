import type { PlanKey } from "@prisma/client";

function catalogFromEnv(): Partial<Record<PlanKey, string>> {
  return {
    STARTER: process.env.WIX_VENDOR_PRODUCT_STARTER || undefined,
    GROWTH: process.env.WIX_VENDOR_PRODUCT_GROWTH || undefined,
    PRO: process.env.WIX_VENDOR_PRODUCT_PRO || undefined,
  };
}

export function wixPlanCatalog() {
  return catalogFromEnv();
}

/**
 * vendorProductId (instance/webhooks) and packageName (Get App Instance)
 * are the same Wix plan identifier from the app dashboard Pricing page.
 */
export function mapWixPackageToPlan(packageName?: string | null): PlanKey {
  if (!packageName) return "FREE";
  const catalog = catalogFromEnv();
  for (const [key, id] of Object.entries(catalog) as [PlanKey, string | undefined][]) {
    if (id && id === packageName) return key;
  }
  const value = packageName.toLowerCase();
  if (value.includes("pro")) return "PRO";
  if (value.includes("growth") || value.includes("plus")) return "GROWTH";
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
