import type { PlanKey } from "@prisma/client";
import { PLAN_SCOPES, planLabel } from "@/modules/billing/catalog";
import { getDisplayPricing } from "@/modules/billing/display-prices";
import { getEnv } from "@/lib/env";
import { parseWixInstance } from "@/lib/security/instance";
import { PricingView } from "@/components/marketing/PricingView";

const PAID_PLANS = ["STARTER", "GROWTH", "PRO"] as const;

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ instance?: string; appInstanceId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const env = getEnv();
  const parsed = params.instance ? parseWixInstance(params.instance, env.WIX_APP_SECRET) : null;
  const instanceToken = params.instance ?? null;
  const instanceId = parsed?.instanceId ?? params.appInstanceId ?? null;
  const installUrl = env.WIX_APP_ID ? `https://www.wix.com/app-market/add-app/${env.WIX_APP_ID}` : null;
  const pricing = await getDisplayPricing();

  const plans = PAID_PLANS.map((key) => {
    const price = pricing.plans[key];
    return {
      key,
      name: price.name || planLabel(key),
      features: PLAN_SCOPES[key].filter((item) => !/7-day/i.test(item)),
      href: checkoutHref(key, instanceToken, instanceId) ?? installUrl,
      featured: key === "GROWTH",
      monthly: price.monthly,
      yearly: price.yearly,
    };
  });

  return (
    <PricingView
      plans={plans}
      trialDays={pricing.trialDays}
      symbol={pricing.symbol}
      error={params.error}
    />
  );
}

function checkoutHref(planKey: PlanKey, instanceToken: string | null, instanceId: string | null) {
  const plan = planKey === "GROWTH" ? "BUSINESS" : planKey;
  if (instanceToken) {
    return `/api/billing/checkout?plan=${plan}&instance=${encodeURIComponent(instanceToken)}`;
  }
  if (instanceId) {
    return `/api/billing/checkout?plan=${plan}&appInstanceId=${encodeURIComponent(instanceId)}`;
  }
  return null;
}
