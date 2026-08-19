import type { PlanKey } from "@prisma/client";
import { PLAN_SCOPES, planLabel } from "@/modules/billing/catalog";
import { getEnv } from "@/lib/env";
import { parseWixInstance } from "@/lib/security/instance";
import { PricingView } from "@/components/marketing/PricingView";

const PAID_PLANS: PlanKey[] = ["STARTER", "GROWTH", "PRO"];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ instance?: string; appInstanceId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const parsed = params.instance ? parseWixInstance(params.instance, getEnv().WIX_APP_SECRET) : null;
  const instanceToken = params.instance ?? null;
  const instanceId = parsed?.instanceId ?? params.appInstanceId ?? null;

  const plans = PAID_PLANS.map((key) => ({
    key,
    name: planLabel(key),
    features: PLAN_SCOPES[key],
    href: checkoutHref(key, instanceToken, instanceId),
  }));

  return (
    <PricingView
      plans={plans}
      installed={Boolean(instanceId)}
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
