import type { PlanKey } from "@prisma/client";
import { z } from "zod";
import { AUTOMATION_CATALOG, type AutomationKey } from "@/modules/automations/catalog";
import { PLAN_ENTITLEMENTS, PLAN_RANK, type Entitlements } from "@/modules/billing/entitlements";

export const PLAN_SCOPES_SETTING_KEY = "plan_scopes";

export const PLAN_KEYS: PlanKey[] = ["FREE", "STARTER", "GROWTH", "PRO"];

const AUTOMATION_KEYS = AUTOMATION_CATALOG.map((item) => item.key) as [
  AutomationKey,
  ...AutomationKey[],
];

export type PlanScanScope = {
  maxPages: number;
  maxProducts: number;
  maxCharsPerPage: number;
  maxCmsCollections: number;
  maxCmsItemsPerCollection: number;
  includeSiteProperties: boolean;
  includeCms: boolean;
  includeStores: boolean;
  includeBookings: boolean;
  includeDomainCrawl: boolean;
  depthNote: string;
};

export type PlanScopeConfig = {
  conversationLimit: number;
  knowledgeLimit: number;
  maxAgents: number;
  voiceEnabled: boolean;
  advancedToolsEnabled: boolean;
  automationEnabled: boolean;
  allTemplates: boolean;
  automations: Record<AutomationKey, boolean>;
  scan: PlanScanScope;
};

const scanSchema = z.object({
  maxPages: z.number().int().min(0).max(20_000),
  maxProducts: z.number().int().min(0).max(50_000),
  maxCharsPerPage: z.number().int().min(0).max(100_000),
  maxCmsCollections: z.number().int().min(0).max(500),
  maxCmsItemsPerCollection: z.number().int().min(0).max(5_000),
  includeSiteProperties: z.boolean(),
  includeCms: z.boolean(),
  includeStores: z.boolean(),
  includeBookings: z.boolean(),
  includeDomainCrawl: z.boolean(),
  depthNote: z.string().max(400),
});

const automationsSchema = z.object({
  greeting: z.boolean(),
  human_handoff: z.boolean(),
  follow_up: z.boolean(),
  specialist_routing: z.boolean(),
  lead_capture: z.boolean(),
  shopping: z.boolean(),
  after_hours: z.boolean(),
});

export const planScopeSchema = z.object({
  conversationLimit: z.number().int().min(0).max(10_000_000),
  knowledgeLimit: z.number().int().min(0).max(1_000_000),
  maxAgents: z.number().int().min(1).max(50),
  voiceEnabled: z.boolean(),
  advancedToolsEnabled: z.boolean(),
  automationEnabled: z.boolean(),
  allTemplates: z.boolean(),
  automations: automationsSchema,
  scan: scanSchema,
});

export const allPlanScopesSchema = z.object({
  FREE: planScopeSchema,
  STARTER: planScopeSchema,
  GROWTH: planScopeSchema,
  PRO: planScopeSchema,
});

const DEFAULT_SCAN: Record<PlanKey, PlanScanScope> = {
  FREE: {
    maxPages: 25,
    maxProducts: 40,
    maxCharsPerPage: 8000,
    maxCmsCollections: 4,
    maxCmsItemsPerCollection: 20,
    includeSiteProperties: true,
    includeCms: true,
    includeStores: true,
    includeBookings: false,
    includeDomainCrawl: true,
    depthNote: "A focused read of your site — enough to try the widget. Upgrade for fuller coverage.",
  },
  STARTER: {
    maxPages: 200,
    maxProducts: 250,
    maxCharsPerPage: 10000,
    maxCmsCollections: 12,
    maxCmsItemsPerCollection: 60,
    includeSiteProperties: true,
    includeCms: true,
    includeStores: true,
    includeBookings: false,
    includeDomainCrawl: true,
    depthNote: "Reads your site profile, pages, CMS, and ecommerce catalog so answers match real content.",
  },
  GROWTH: {
    maxPages: 500,
    maxProducts: 5000,
    maxCharsPerPage: 12000,
    maxCmsCollections: 24,
    maxCmsItemsPerCollection: 100,
    includeSiteProperties: true,
    includeCms: true,
    includeStores: true,
    includeBookings: true,
    includeDomainCrawl: true,
    depthNote: "Deeper site coverage — pages, CMS, full store catalog, and bookings when available.",
  },
  PRO: {
    maxPages: 1000,
    maxProducts: 20000,
    maxCharsPerPage: 14000,
    maxCmsCollections: 50,
    maxCmsItemsPerCollection: 180,
    includeSiteProperties: true,
    includeCms: true,
    includeStores: true,
    includeBookings: true,
    includeDomainCrawl: true,
    depthNote: "Maximum coverage — site profile, pages, CMS, store catalog, and bookings this site exposes.",
  },
};

function defaultAutomations(planKey: PlanKey): Record<AutomationKey, boolean> {
  return Object.fromEntries(
    AUTOMATION_CATALOG.map((item) => [item.key, PLAN_RANK[planKey] >= PLAN_RANK[item.minPlan]]),
  ) as Record<AutomationKey, boolean>;
}

export function defaultPlanScope(planKey: PlanKey): PlanScopeConfig {
  const limits = PLAN_ENTITLEMENTS[planKey];
  return {
    conversationLimit: limits.conversationLimit,
    knowledgeLimit: limits.knowledgeLimit,
    maxAgents: limits.maxAgents,
    voiceEnabled: limits.voiceEnabled,
    advancedToolsEnabled: limits.advancedToolsEnabled,
    automationEnabled: limits.automationEnabled,
    allTemplates: limits.allTemplates,
    automations: defaultAutomations(planKey),
    scan: DEFAULT_SCAN[planKey],
  };
}

export const DEFAULT_PLAN_SCOPES: Record<PlanKey, PlanScopeConfig> = {
  FREE: defaultPlanScope("FREE"),
  STARTER: defaultPlanScope("STARTER"),
  GROWTH: defaultPlanScope("GROWTH"),
  PRO: defaultPlanScope("PRO"),
};

export function mergePlanScope(planKey: PlanKey, raw: unknown): PlanScopeConfig {
  const fallback = defaultPlanScope(planKey);
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = planScopeSchema
    .extend({
      automations: automationsSchema.partial(),
      scan: scanSchema.partial(),
    })
    .partial()
    .safeParse(raw);
  if (!parsed.success) return fallback;
  const next = parsed.data;
  return {
    ...fallback,
    ...next,
    knowledgeLimit: Math.max(fallback.knowledgeLimit, next.knowledgeLimit ?? 0),
    automations: { ...fallback.automations, ...next.automations },
    scan: {
      ...fallback.scan,
      ...next.scan,
      maxPages: Math.max(fallback.scan.maxPages, next.scan?.maxPages ?? 0),
      maxProducts: Math.max(fallback.scan.maxProducts, next.scan?.maxProducts ?? 0),
      maxCharsPerPage: Math.max(fallback.scan.maxCharsPerPage, next.scan?.maxCharsPerPage ?? 0),
      maxCmsCollections: Math.max(fallback.scan.maxCmsCollections, next.scan?.maxCmsCollections ?? 0),
      maxCmsItemsPerCollection: Math.max(
        fallback.scan.maxCmsItemsPerCollection,
        next.scan?.maxCmsItemsPerCollection ?? 0,
      ),
      // Keep API reads enabled when the default plan turned them on (avoids stale FREE=0 scopes blocking scans).
      includeSiteProperties: Boolean(fallback.scan.includeSiteProperties || next.scan?.includeSiteProperties),
      includeCms: Boolean(fallback.scan.includeCms || next.scan?.includeCms),
      includeStores: Boolean(fallback.scan.includeStores || next.scan?.includeStores),
      includeBookings: Boolean(fallback.scan.includeBookings || next.scan?.includeBookings),
      includeDomainCrawl: Boolean(fallback.scan.includeDomainCrawl || next.scan?.includeDomainCrawl),
    },
  };
}

export function cloneAllPlanScopes(scopes: Record<PlanKey, PlanScopeConfig>): Record<PlanKey, PlanScopeConfig> {
  return JSON.parse(JSON.stringify(scopes)) as Record<PlanKey, PlanScopeConfig>;
}

export function mergeAllPlanScopes(raw: unknown): Record<PlanKey, PlanScopeConfig> {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    FREE: mergePlanScope("FREE", source.FREE),
    STARTER: mergePlanScope("STARTER", source.STARTER),
    GROWTH: mergePlanScope("GROWTH", source.GROWTH),
    PRO: mergePlanScope("PRO", source.PRO),
  };
}

export function applyPlanScope(entitlements: Entitlements, scope: PlanScopeConfig): Entitlements {
  return {
    ...entitlements,
    conversationLimit: scope.conversationLimit,
    knowledgeLimit: scope.knowledgeLimit,
    maxAgents: scope.maxAgents,
    voiceEnabled: scope.voiceEnabled,
    advancedToolsEnabled: scope.advancedToolsEnabled,
    automationEnabled: scope.automationEnabled,
    allTemplates: scope.allTemplates,
    automations: scope.automations,
  };
}

export function automationAllowedOnScope(scope: PlanScopeConfig, key: AutomationKey) {
  if (!scope.automationEnabled) return false;
  return Boolean(scope.automations[key]);
}

export function bulletsForPlanScope(planKey: PlanKey, scope: PlanScopeConfig): string[] {
  if (planKey === "FREE") {
    return [
      "1 general agent",
      "Classic chat widget",
      "Site profile and sample pages",
      scope.scan.includeStores ? "Sample of the store catalog" : "Upgrade for store catalog",
      `${scope.conversationLimit.toLocaleString()} conversations / month`,
      `${scope.knowledgeLimit.toLocaleString()} knowledge pages`,
      "Upgrade anytime for fuller coverage",
    ];
  }

  const bullets: string[] = ["7-day free trial"];
  bullets.push(
    scope.maxAgents <= 1
      ? "1 general agent"
      : `Up to ${scope.maxAgents} agents${scope.automations.specialist_routing ? " with specialist routing" : ""}`,
  );
  bullets.push(scope.allTemplates ? "All four widget looks (Classic, Atelier, Dock, Noir)" : "Classic chat widget");

  const knowledge: string[] = ["Site profile and pages"];
  if (scope.scan.includeCms) knowledge.push("CMS");
  if (scope.scan.includeStores) knowledge.push("store catalog");
  if (scope.scan.includeBookings) knowledge.push("bookings");
  bullets.push(knowledge.join(", "));

  const autos = AUTOMATION_KEYS.filter((key) => automationAllowedOnScope(scope, key)).map((key) => {
    const item = AUTOMATION_CATALOG.find((row) => row.key === key);
    return item?.label.toLowerCase() ?? key.replaceAll("_", " ");
  });
  if (autos.length) bullets.push(`${autos.join(", ")} automations`);
  if (scope.voiceEnabled) bullets.push("Spoken replies (Google Cloud TTS, Amazon Polly fallback)");
  bullets.push(`${scope.conversationLimit.toLocaleString()} conversations / month`);
  bullets.push(`${scope.knowledgeLimit.toLocaleString()} knowledge pages`);
  if (planKey === "PRO") bullets.push("Priority-ready capacity for peak traffic");
  return bullets;
}

const EDITOR_LABELS: Record<PlanKey, string> = {
  FREE: "Free",
  STARTER: "Starter",
  GROWTH: "Business",
  PRO: "Pro",
};

export function planScopeEditorMeta() {
  return {
    plans: PLAN_KEYS.map((key) => ({
      key,
      label: EDITOR_LABELS[key],
    })),
    automations: AUTOMATION_CATALOG.map((item) => ({
      key: item.key,
      label: item.label,
      blurb: item.blurb,
    })),
  };
}
