import type { PlanKey } from "@prisma/client";
import type { CrawlItem, ScanResult, SiteUnderstanding } from "@/modules/knowledge/types";

type BrandBundle = {
  colors: string[];
  images: string[];
  phrases: string[];
};

/** Rebuild a filled ScanResult so the collection board stays populated after onboarding. */
export function scanSnapshotFromStore(input: {
  planKey: PlanKey;
  planLabel: string;
  scopeNote: string;
  siteUrl?: string | null;
  understanding?: SiteUnderstanding | null;
  crawl?: CrawlItem[];
  brand?: BrandBundle | null;
  counts: {
    pages: number;
    products: number;
    faqs: number;
    policies: number;
    chunks?: number;
    facts?: number;
    conflicts?: number;
  };
  analyzedAt?: string | null;
}): ScanResult | null {
  const crawl = input.crawl ?? [];
  const hasSignal =
    Boolean(input.understanding) ||
    crawl.length > 0 ||
    input.counts.pages > 0 ||
    input.counts.products > 0 ||
    input.counts.faqs > 0 ||
    input.counts.policies > 0 ||
    (input.brand?.colors?.length ?? 0) > 0 ||
    (input.brand?.images?.length ?? 0) > 0;

  if (!hasSignal) return null;

  const pageCount =
    input.counts.pages ||
    crawl.filter((item) => item.status === "crawled" && item.contentType !== "PRODUCT" && !String(item.origin).includes("store"))
      .length;

  return {
    ok: true,
    planKey: input.planKey,
    planLabel: input.planLabel,
    scopeNote: input.scopeNote,
    siteUrl: input.siteUrl ?? null,
    understanding: input.understanding ?? null,
    counts: {
      pages: pageCount,
      products: input.counts.products,
      faqs: input.counts.faqs,
      policies: input.counts.policies,
      chunks: input.counts.chunks ?? 0,
      facts: input.counts.facts ?? 0,
      conflicts: input.counts.conflicts ?? 0,
    },
    sources: crawl.slice(0, 40).map((item) => ({
      title: item.title,
      url: item.url,
      type: item.contentType as ScanResult["sources"][number]["type"],
    })),
    crawl,
    stages: [
      {
        key: "stored",
        label: "Loaded saved site knowledge",
        status: "done",
        detail: `${pageCount} pages · ${input.counts.products} products`,
      },
    ],
    skipped: [],
    warnings: [],
    analyzedAt: input.analyzedAt || new Date().toISOString(),
    brand: input.brand ?? undefined,
  };
}

export function parseScanSourceMeta(metadata: unknown): {
  crawl: CrawlItem[];
  brand: BrandBundle | null;
} {
  const meta = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
  const crawl = Array.isArray(meta.crawl) ? (meta.crawl as CrawlItem[]) : [];
  const brandRaw = meta.brand && typeof meta.brand === "object" && !Array.isArray(meta.brand)
    ? (meta.brand as Record<string, unknown>)
    : null;
  const brand = brandRaw
    ? {
        colors: Array.isArray(brandRaw.colors) ? brandRaw.colors.map(String) : [],
        images: Array.isArray(brandRaw.images) ? brandRaw.images.map(String) : [],
        phrases: Array.isArray(brandRaw.phrases) ? brandRaw.phrases.map(String) : [],
      }
    : null;
  return { crawl, brand };
}
