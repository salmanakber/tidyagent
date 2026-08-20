import { cache } from "react";
import type { PlanKey } from "@prisma/client";
import { getSetting, setSetting } from "@/lib/security/settings";
import {
  DEFAULT_PLAN_SCOPES,
  PLAN_SCOPES_SETTING_KEY,
  allPlanScopesSchema,
  cloneAllPlanScopes,
  defaultPlanScope,
  mergeAllPlanScopes,
  type PlanScopeConfig,
} from "@/modules/billing/plan-scopes";

export const getAllPlanScopes = cache(async (): Promise<Record<PlanKey, PlanScopeConfig>> => {
  const stored = await getSetting(PLAN_SCOPES_SETTING_KEY, "");
  if (!stored) return cloneAllPlanScopes(DEFAULT_PLAN_SCOPES);
  try {
    return cloneAllPlanScopes(mergeAllPlanScopes(JSON.parse(stored) as unknown));
  } catch {
    return cloneAllPlanScopes(DEFAULT_PLAN_SCOPES);
  }
});

export async function getPlanScope(planKey: PlanKey): Promise<PlanScopeConfig> {
  const all = await getAllPlanScopes();
  return all[planKey] ?? defaultPlanScope(planKey);
}

export async function saveAllPlanScopes(input: Record<PlanKey, PlanScopeConfig>) {
  const parsed = allPlanScopesSchema.parse(input);
  await setSetting(PLAN_SCOPES_SETTING_KEY, JSON.stringify(parsed));
}
