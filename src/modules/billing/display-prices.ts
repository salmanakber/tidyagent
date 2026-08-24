import { createClient } from "@wix/sdk";
import { appPlans } from "@wix/app-management";
import type { PlanKey } from "@prisma/client";
import { getEnv } from "@/lib/env";
import { getSetting } from "@/lib/security/settings";
import { mapWixPackageToPlan, planLabel, wixProductIdForPlan } from "@/modules/billing/catalog";
import { loadPlatformPrices } from "@/modules/billing/platform-prices";
import { isWixPlatform, resolveSitePlatform, type SitePlatform } from "@/modules/platforms/types";

export type DisplayPlanPrice = {
  key: PlanKey;
  name: string;
  monthly: string | null;
  yearly: string | null;
};

export type DisplayPricing = {
  source: "wix" | "manual";
  currency: string;
  symbol: string;
  trialDays: number;
  plans: Record<"STARTER" | "GROWTH" | "PRO", DisplayPlanPrice>;
};

const SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "$",
  AUD: "$",
  PKR: "Rs",
};

function emptyPlan(key: PlanKey): DisplayPlanPrice {
  return { key, name: planLabel(key), monthly: null, yearly: null };
}

export async function getDisplayPricing(platform?: string | null): Promise<DisplayPricing> {
  const trialDays = Number(await getSetting("plan_trial_days", "7")) || 7;
  const resolved = resolveSitePlatform(platform);
  if (isWixPlatform(resolved)) {
    const fromWix = await fetchWixPlanPrices();
    if (fromWix) {
      return { ...fromWix, trialDays: fromWix.trialDays || trialDays };
    }
  }
  return loadManualPrices(resolved, trialDays);
}

async function loadManualPrices(platform: SitePlatform, trialDays: number): Promise<DisplayPricing> {
  const prices = await loadPlatformPrices(platform);
  const code = prices.currency.toUpperCase() || "USD";
  return {
    source: "manual",
    currency: code,
    symbol: SYMBOLS[code] ?? "$",
    trialDays,
    plans: {
      STARTER: { key: "STARTER", name: "Starter", monthly: prices.starter || null, yearly: null },
      GROWTH: { key: "GROWTH", name: "Business", monthly: prices.business || null, yearly: null },
      PRO: { key: "PRO", name: "Pro", monthly: prices.pro || null, yearly: null },
    },
  };
}

async function fetchWixPlanPrices(): Promise<DisplayPricing | null> {
  const appId = getEnv().WIX_APP_ID;
  if (!appId) return null;

  try {
    const client = createClient({ modules: { appPlans } });
    const response = await client.appPlans.listAppPlansByAppId([appId]);
    const listed = response.appPlans?.flatMap((group) => group.plans ?? []) ?? [];
    if (listed.length === 0) return null;

    const currency = response.currency || "USD";
    const symbol = decodeSymbol(response.currencySymbol) || SYMBOLS[currency] || "$";
    const next: DisplayPricing = {
      source: "wix",
      currency,
      symbol,
      trialDays: 7,
      plans: {
        STARTER: emptyPlan("STARTER"),
        GROWTH: emptyPlan("GROWTH"),
        PRO: emptyPlan("PRO"),
      },
    };

    for (const plan of listed) {
      const key = resolvePlanKey(plan.vendorId, plan.name);
      if (key !== "STARTER" && key !== "GROWTH" && key !== "PRO") continue;
      const monthly = pickAmount(plan.prices, "MONTH");
      const yearly = pickAmount(plan.prices, "YEAR");
      next.plans[key] = {
        key,
        name: plan.name || planLabel(key),
        monthly: monthly ?? next.plans[key].monthly,
        yearly: yearly ?? next.plans[key].yearly,
      };
    }

    return next;
  } catch {
    return null;
  }
}

function resolvePlanKey(vendorId?: string | null, name?: string | null): PlanKey {
  for (const key of ["STARTER", "GROWTH", "PRO"] as const) {
    const configured = wixProductIdForPlan(key);
    if (configured && vendorId && configured === vendorId) return key;
  }
  return mapWixPackageToPlan(vendorId || name);
}

function pickAmount(
  prices: { priceBeforeTax?: string; totalPrice?: string; billingCycle?: { cycleDuration?: { unit?: string } } }[] | undefined,
  unit: "MONTH" | "YEAR",
) {
  if (!prices?.length) return null;
  const match = prices.find((price) => price.billingCycle?.cycleDuration?.unit === unit) ?? (unit === "MONTH" ? prices[0] : undefined);
  const raw = match?.totalPrice || match?.priceBeforeTax;
  if (!raw) return null;
  const amount = Number(raw);
  if (Number.isNaN(amount)) return raw;
  return amount % 1 === 0 ? String(amount) : amount.toFixed(2);
}

function decodeSymbol(value?: string) {
  if (!value) return null;
  const entity = value.match(/^&#(\d+);$/);
  if (entity) return String.fromCharCode(Number(entity[1]));
  return value;
}
