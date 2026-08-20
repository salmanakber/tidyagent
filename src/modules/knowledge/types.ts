import type { KnowledgeContentType, PlanKey } from "@prisma/client";

export type SiteUnderstanding = {
  name: string;
  industry: string;
  businessType: string;
  businessModel: string;
  summary: string;
  audience: string;
  tone: string;
  offerings: string[];
  faqs: string[];
  policies: string[];
  contact: { emails: string[]; phones: string[]; hours?: string };
  differentiators: string[];
  confidence: "high" | "medium" | "low";
};

export type ScanStage = {
  key: string;
  label: string;
  status: "done" | "skipped" | "failed";
  detail: string;
};

export type ScanResult = {
  ok: boolean;
  planKey: PlanKey;
  planLabel: string;
  scopeNote: string;
  siteUrl: string | null;
  understanding: SiteUnderstanding | null;
    counts: { pages: number; products: number; faqs: number; policies: number; chunks: number; facts?: number; conflicts?: number };
  sources: { title: string; url: string; type: KnowledgeContentType }[];
  stages: ScanStage[];
  skipped: string[];
  warnings: string[];
  analyzedAt: string;
};
