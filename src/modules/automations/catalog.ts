import type { PlanKey } from "@prisma/client";
import { PLAN_RANK, type Entitlements } from "@/modules/billing/entitlements";
import { planLabel } from "@/modules/billing/catalog";

export type AutomationKey =
  | "greeting"
  | "human_handoff"
  | "follow_up"
  | "specialist_routing"
  | "lead_capture"
  | "shopping"
  | "after_hours";

export const AUTOMATION_CATALOG: {
  key: AutomationKey;
  label: string;
  blurb: string;
  minPlan: PlanKey;
  aliases: string[];
}[] = [
  {
    key: "greeting",
    label: "Welcome greeting",
    blurb: "Greet returning visitors by name of the business and invite a real question.",
    minPlan: "STARTER",
    aliases: ["support"],
  },
  {
    key: "human_handoff",
    label: "Human handoff",
    blurb: "Offer to connect a person when the AI does not have a verified answer.",
    minPlan: "STARTER",
    aliases: ["complaints"],
  },
  {
    key: "follow_up",
    label: "Follow-up question",
    blurb: "After a short answer, ask if there is anything else they need.",
    minPlan: "STARTER",
    aliases: [],
  },
  {
    key: "specialist_routing",
    label: "Connect specialists",
    blurb: "When the question needs a store, support, or bookings agent, transfer with a visible handoff.",
    minPlan: "GROWTH",
    aliases: ["handoff"],
  },
  {
    key: "lead_capture",
    label: "Capture emails",
    blurb: "If a visitor leaves an email, save it as a lead for the workspace.",
    minPlan: "GROWTH",
    aliases: ["sales"],
  },
  {
    key: "shopping",
    label: "Store & product help",
    blurb: "Use catalog knowledge and the store specialist for products, prices, and orders.",
    minPlan: "GROWTH",
    aliases: [],
  },
  {
    key: "after_hours",
    label: "After-hours note",
    blurb: "Between 8pm and 8am (UTC), mention the team is away while still answering.",
    minPlan: "GROWTH",
    aliases: [],
  },
];

export function planAllowsAutomation(planKey: PlanKey, key: AutomationKey) {
  const item = AUTOMATION_CATALOG.find((row) => row.key === key);
  if (!item) return false;
  return PLAN_RANK[planKey] >= PLAN_RANK[item.minPlan];
}

export function automationAllowedForEntitlements(
  entitlements: Pick<Entitlements, "planKey" | "automationEnabled" | "automations">,
  key: AutomationKey,
) {
  if (!entitlements.automationEnabled) return false;
  if (entitlements.automations) return Boolean(entitlements.automations[key]);
  return planAllowsAutomation(entitlements.planKey, key);
}

export function automationLockedHint(key: AutomationKey) {
  const item = AUTOMATION_CATALOG.find((row) => row.key === key);
  if (!item || item.minPlan === "STARTER") return null;
  return `Included on ${planLabel(item.minPlan)} and Pro`;
}

export function isWorkflowOn(
  rows: { key: string; enabled: boolean }[],
  key: AutomationKey,
  fallback = true,
) {
  const item = AUTOMATION_CATALOG.find((row) => row.key === key);
  const names = [key, ...(item?.aliases ?? [])];
  const match = rows.find((row) => names.includes(row.key));
  if (!match) return fallback;
  return match.enabled;
}
