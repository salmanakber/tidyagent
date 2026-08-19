import type { PlanKey, SubscriptionStatus } from "@prisma/client";
import { mapWixPackageToPlan } from "@/modules/billing/catalog";

export { mapWixPackageToPlan } from "@/modules/billing/catalog";

export type Entitlements = {
  planKey: PlanKey;
  status: SubscriptionStatus;
  conversationLimit: number;
  knowledgeLimit: number;
  voiceEnabled: boolean;
  advancedToolsEnabled: boolean;
  automationEnabled: boolean;
  isFree: boolean;
  isPaidSeat: boolean;
  isUsable: boolean;
  cancelAtPeriodEnd: boolean;
  billingIssue: boolean;
};

export const PLAN_ENTITLEMENTS: Record<PlanKey, Omit<Entitlements, "planKey" | "status" | "isUsable" | "isFree" | "isPaidSeat" | "cancelAtPeriodEnd" | "billingIssue">> = {
  FREE: {
    conversationLimit: 100,
    knowledgeLimit: 50,
    voiceEnabled: false,
    advancedToolsEnabled: false,
    automationEnabled: false,
  },
  STARTER: {
    conversationLimit: 1000,
    knowledgeLimit: 250,
    voiceEnabled: false,
    advancedToolsEnabled: false,
    automationEnabled: true,
  },
  GROWTH: {
    conversationLimit: 5000,
    knowledgeLimit: 1000,
    voiceEnabled: false,
    advancedToolsEnabled: true,
    automationEnabled: true,
  },
  PRO: {
    conversationLimit: 25000,
    knowledgeLimit: 5000,
    voiceEnabled: true,
    advancedToolsEnabled: true,
    automationEnabled: true,
  },
};

export function resolveEntitlements(input: {
  planKey: PlanKey;
  status: SubscriptionStatus;
  isFree: boolean;
  cancelAtPeriodEnd?: boolean;
  billingIssue?: boolean;
  currentPeriodEnd?: Date | null;
  suspended?: boolean;
  now?: Date;
}): Entitlements {
  const now = input.now ?? new Date();
  const stillInPaidPeriod =
    Boolean(input.cancelAtPeriodEnd) &&
    Boolean(input.currentPeriodEnd) &&
    input.currentPeriodEnd!.getTime() > now.getTime();

  const isPaidSeat =
    !input.isFree &&
    (input.status === "ACTIVE" ||
      input.status === "TRIALING" ||
      input.status === "PAST_DUE" ||
      (input.status === "CANCELED" && stillInPaidPeriod));

  const planKey = isPaidSeat ? input.planKey : "FREE";
  const limits = PLAN_ENTITLEMENTS[planKey];
  const isUsable = !input.suspended && (isPaidSeat || planKey === "FREE");

  return {
    planKey,
    status: input.status,
    ...limits,
    isFree: !isPaidSeat,
    isPaidSeat,
    isUsable,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    billingIssue: Boolean(input.billingIssue),
  };
}

export function assertEntitlement(
  entitlements: Entitlements,
  feature: keyof Pick<
    Entitlements,
    "voiceEnabled" | "advancedToolsEnabled" | "automationEnabled" | "isUsable"
  >,
) {
  if (!entitlements[feature]) {
    throw new EntitlementDeniedError(feature);
  }
}

export class EntitlementDeniedError extends Error {
  constructor(public feature: string) {
    super(`This plan does not include ${feature}`);
    this.name = "EntitlementDeniedError";
  }
}

export class UsageLimitError extends Error {
  constructor(public metric: string) {
    super(`${metric} limit reached for this plan`);
    this.name = "UsageLimitError";
  }
}
