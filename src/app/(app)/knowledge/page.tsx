import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { platformLabel } from "@/modules/platforms";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddKnowledgeForm } from "@/components/knowledge/AddKnowledgeForm";
import { SiteScanPanel } from "@/components/knowledge/SiteScanPanel";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { planLabel } from "@/modules/billing/catalog";
import { scanScopeFromConfig } from "@/modules/knowledge/scan-scope";
import { getPlanScope } from "@/modules/billing/plan-scope-store";
import { knowledgeCardsForSite, siteFactsForSite } from "@/modules/knowledge/site-facts";
import { KnowledgeIntelligence } from "@/components/knowledge/KnowledgeIntelligence";
import { prisma } from "@/lib/prisma";
import type { CrawlItem } from "@/modules/knowledge/types";
import type { Prisma } from "@prisma/client";
import { copyForPlatform, wizardCopyForPlatform } from "@/modules/platforms/copy";
import { resolveSitePlatform } from "@/modules/platforms";

export const maxDuration = 120;

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);
  const entitlements = await entitlementsForOrganization(session.organizationId);
  const planScope = await getPlanScope(entitlements.planKey);
  const scope = scanScopeFromConfig(entitlements.planKey, planScope);

  const facts = siteFactsForSite({
    platform: session.platform,
    installedWixApps: data.site.installedWixApps,
    capabilities: data.site.capabilities,
  });
  const copy = wizardCopyForPlatform(session.platform);
  const platform = resolveSitePlatform(session.platform);
  const [storedFacts, conflicts, documents, scanSource, customNotes] = await Promise.all([
    prisma.knowledgeFact.findMany({
      where: { organizationId: session.organizationId, siteId: session.siteId },
      orderBy: [{ kind: "asc" }, { entity: "asc" }],
      take: 200,
    }),
    prisma.knowledgeConflict.findMany({
      where: { organizationId: session.organizationId, siteId: session.siteId, status: "OPEN" },
      take: 20,
    }),
    prisma.knowledgeDocument.findMany({
      where: { organizationId: session.organizationId, siteId: session.siteId, contentType: { not: "CUSTOM" } },
      select: { id: true, title: true, sourceUrl: true, contentType: true, metadata: true },
      orderBy: { updatedAt: "desc" },
      take: 4000,
    }),
    prisma.knowledgeSource.findFirst({
      where: { organizationId: session.organizationId, siteId: session.siteId, type: "site-scan" },
      select: { metadata: true, pagesDiscovered: true, pagesCrawled: true },
    }),
    prisma.knowledgeDocument.findMany({
      where: { organizationId: session.organizationId, siteId: session.siteId, contentType: "CUSTOM" },
      select: { id: true, title: true, cleanedContent: true, metadata: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);
  const indexedPages = mergeCrawlIndex(documents, scanSource?.metadata);
  const cards = knowledgeCardsForSite({
    hasStores: facts.hasStores,
    hasBookings: facts.hasBookings,
    pages: indexedPages.filter((item) => item.contentType !== "PRODUCT" && item.status === "crawled").length,
    products: indexedPages.filter((item) => item.contentType === "PRODUCT" && item.status === "crawled").length,
    faqs: data.knowledge.faqs,
    policies: data.knowledge.policies,
    custom: data.knowledge.custom,
    facts: storedFacts.length,
    conflicts: conflicts.length,
    platform: session.platform,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Business knowledge"
        title="What your AI employee knows"
        description={copy.knowledgeDescription(platformLabel(session.platform))}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="panel p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">{card.label}</p>
            <p className="mt-3 font-display text-3xl text-white">{card.value}</p>
            <p className="mt-1 text-xs text-navy-400">{card.hint}</p>
          </div>
        ))}
      </div>
      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">
          {copy.hideDomainCrawlToggle ? "Update what the AI knows" : "Website scanner"}
        </h2>
        <p className="mt-2 text-sm text-navy-300">
          {copy.hideDomainCrawlToggle
            ? "Re-run this after you change pages or products. Last update: "
            : "Re-run this after you change pages, policies, or products. Last sync: "}
          {data.knowledge.lastSyncedAt ? new Date(data.knowledge.lastSyncedAt).toLocaleString() : "not yet"}
        </p>
        {facts.hasStores || platform === "SHOPIFY" ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Ecommerce</p>
            <p className="mt-2 text-sm leading-6 text-navy-100">
              Products, prices, and images are taught to your chat when you run the scanner on a paid plan. Ask the
              widget about any product and it can reply with product cards.
            </p>
            <p className="mt-2 text-xs text-navy-400">
              {indexedPages.filter((item) => item.contentType === "PRODUCT" && item.status === "crawled").length}{" "}
              products currently loaded
            </p>
          </div>
        ) : null}
        {data.profile?.summary ? (
          <p className="mt-4 rounded-2xl bg-navy-950/40 p-4 text-sm leading-6 text-navy-100">{data.profile.summary}</p>
        ) : null}
        <div className="mt-6">
          <SiteScanPanel
            planLabel={planLabel(entitlements.planKey)}
            scopeNote={copyForPlatform(platform, scope.depthNote)}
            siteUrl={data.site.url}
            platform={session.platform}
          />
        </div>
      </div>
      <AddKnowledgeForm
        platform={session.platform}
        lastSynced={data.knowledge.lastSyncedAt?.toISOString() ?? null}
        notes={customNotes.map((row) => {
          const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
          return {
            id: row.id,
            title: row.title,
            content: row.cleanedContent || "",
            priority: Boolean(meta.priority),
            sensitive: Boolean(meta.sensitive),
          };
        })}
      />
      <KnowledgeIntelligence
        platform={session.platform}
        facts={storedFacts.map((row) => ({
          id: row.id,
          kind: row.kind,
          entity: row.entity,
          value: row.value,
          sourceUrl: row.sourceUrl,
          confidence: row.confidence,
          extractionMethod: row.extractionMethod,
        }))}
        conflicts={conflicts.map((row) => ({
          id: row.id,
          entity: row.entity,
          kind: row.kind,
          values: Array.isArray(row.values) ? (row.values as { value?: string; sourceUrl?: string }[]) : [],
        }))}
        pages={indexedPages}
      />
    </div>
  );
}

function mergeCrawlIndex(
  documents: { id: string; title: string; sourceUrl: string | null; contentType: string; metadata: Prisma.JsonValue }[],
  metadata: Prisma.JsonValue | undefined,
) {
  const fromDocs = documents.map((row) => {
    const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
    return {
      id: row.id,
      title: row.title,
      sourceUrl: row.sourceUrl,
      contentType: row.contentType,
      status: "crawled" as const,
      origin: String(meta.origin || (row.contentType === "PRODUCT" ? "wix-store" : "website")),
    };
  });
  const seen = new Set(fromDocs.map((row) => normalizeUrl(row.sourceUrl)));
  const extra = crawlFromMetadata(metadata).filter((item) => !seen.has(normalizeUrl(item.url)));
  return [
    ...fromDocs,
    ...extra.map((item, index) => ({
      id: `pending-${index}-${item.url}`,
      title: item.title || item.url,
      sourceUrl: item.url,
      contentType: item.contentType,
      status: item.status,
      origin: item.origin,
    })),
  ];
}

function crawlFromMetadata(metadata: Prisma.JsonValue | undefined): CrawlItem[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const crawl = (metadata as { crawl?: unknown }).crawl;
  if (!Array.isArray(crawl)) return [];
  return crawl.filter(isCrawlItem);
}

function isCrawlItem(value: unknown): value is CrawlItem {
  if (!value || typeof value !== "object") return false;
  const row = value as CrawlItem;
  return typeof row.url === "string" && typeof row.status === "string";
}

function normalizeUrl(value: string | null | undefined) {
  return (value || "").replace(/\/$/, "").toLowerCase();
}
