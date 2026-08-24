import type { PlanKey } from "@prisma/client";
import { getSetting } from "@/lib/security/settings";
import { isWixPlatform, resolveSitePlatform, type SitePlatform } from "@/modules/platforms/types";

export type PlatformPriceFields = {
  starter: string;
  business: string;
  pro: string;
  currency: string;
};

const LEGACY_KEYS = {
  starter: "plan_price_starter",
  business: "plan_price_business",
  pro: "plan_price_pro",
  currency: "plan_price_currency",
} as const;

export function platformPriceKeys(platform: SitePlatform) {
  const slug = platform.toLowerCase();
  return {
    starter: `plan_price_${slug}_starter`,
    business: `plan_price_${slug}_business`,
    pro: `plan_price_${slug}_pro`,
    currency: `plan_price_${slug}_currency`,
  };
}

export function priceForPlan(prices: PlatformPriceFields, key: "STARTER" | "GROWTH" | "PRO") {
  if (key === "STARTER") return prices.starter;
  if (key === "GROWTH") return prices.business;
  return prices.pro;
}

export async function loadPlatformPrices(platform?: string | null): Promise<PlatformPriceFields> {
  const resolved = resolveSitePlatform(platform);
  const keys = platformPriceKeys(resolved);
  const [
    starter,
    business,
    pro,
    currency,
    legacyStarter,
    legacyBusiness,
    legacyPro,
    legacyCurrency,
  ] = await Promise.all([
    getSetting(keys.starter),
    getSetting(keys.business),
    getSetting(keys.pro),
    getSetting(keys.currency),
    getSetting(LEGACY_KEYS.starter),
    getSetting(LEGACY_KEYS.business),
    getSetting(LEGACY_KEYS.pro),
    getSetting(LEGACY_KEYS.currency, "USD"),
  ]);

  const fallback = isWixPlatform(resolved) || !(starter || business || pro);
  return {
    starter: starter || (fallback ? legacyStarter : ""),
    business: business || (fallback ? legacyBusiness : ""),
    pro: pro || (fallback ? legacyPro : ""),
    currency: (currency || (fallback ? legacyCurrency : "") || "USD").toUpperCase(),
  };
}

export async function loadAllPlatformPrices() {
  const [wix, webflow, shopify] = await Promise.all([
    loadPlatformPrices("WIX"),
    loadPlatformPrices("WEBFLOW"),
    loadPlatformPrices("SHOPIFY"),
  ]);
  return { wix, webflow, shopify };
}

export function formatListedPrice(amount: string | null | undefined, symbol: string) {
  if (!amount) return null;
  const trimmed = amount.trim();
  if (!trimmed) return null;
  if (/[^\d.]/.test(trimmed)) return trimmed;
  return `${symbol}${trimmed}`;
}

export const PAID_PLAN_KEYS: Array<Extract<PlanKey, "STARTER" | "GROWTH" | "PRO">> = [
  "STARTER",
  "GROWTH",
  "PRO",
];
