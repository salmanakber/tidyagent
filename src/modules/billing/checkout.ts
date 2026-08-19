import { createWixAppClient } from "@/services/wix/client";
import { getAppOrigin } from "@/lib/env";
import { wixProductIdForPlan, wixUpgradeUrl } from "@/modules/billing/catalog";
import type { PlanKey } from "@prisma/client";

export async function wixCheckoutUrl(input: {
  instanceId: string;
  planKey: PlanKey;
  cycle?: "MONTHLY" | "YEARLY";
}) {
  const productId = wixProductIdForPlan(input.planKey);
  if (!productId) {
    return wixUpgradeUrl(input.instanceId);
  }

  try {
    const client = createWixAppClient(input.instanceId);
    const response = await client.billing.getUrl(productId, {
      billingCycle: input.cycle ?? "MONTHLY",
      successUrl: `${getAppOrigin()}/billing`,
    });
    return response.checkoutUrl ?? wixUpgradeUrl(input.instanceId);
  } catch {
    return wixUpgradeUrl(input.instanceId);
  }
}
