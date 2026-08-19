import type { KnowledgeContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { fetchWixAppInstance } from "@/services/wix/client";
import { scanScopeForPlan, pathPriority, type ScanScope } from "@/modules/knowledge/scan-scope";
import {
  chunkText,
  extractPage,
  isSafeHttpUrl,
  parseSitemapUrls,
  sameSite,
  type ExtractedPage,
} from "@/modules/knowledge/extract";
import { harvestWixApis } from "@/modules/knowledge/wix-sources";
import { understandSite, type SiteUnderstanding } from "@/modules/knowledge/understand";
import { getAIProvider } from "@/modules/ai/factory";
import { detectWixCapabilities } from "@/modules/wix/capabilities";
import type { ScanResult, ScanStage } from "@/modules/knowledge/types";

const FETCH_TIMEOUT_MS = 9000;
const MAX_BYTES = 900_000;

export async function scanOrganizationSite(input: {
  organizationId: string;
  siteId: string;
  wixInstanceId: string;
}): Promise<ScanResult> {
  const stages: ScanStage[] = [];
  const warnings: string[] = [];
  const skipped: string[] = [];

  const entitlements = await entitlementsForOrganization(input.organizationId);
  if (!entitlements.isPaidSeat) {
    throw new Error("A purchased plan is required before the site can be read.");
  }
  const scope = scanScopeForPlan(entitlements.planKey);
  const site = await prisma.wixSite.findFirst({
    where: { id: input.siteId, organizationId: input.organizationId },
  });
  if (!site) {
    throw new Error("Site not found");
  }

  let siteUrl = site.url;
  try {
    const snapshot = await fetchWixAppInstance(input.wixInstanceId);
    siteUrl = snapshot.site.url || siteUrl;
    await prisma.wixSite.update({
      where: { id: site.id },
      data: {
        url: snapshot.site.url ?? site.url,
        displayName: snapshot.site.displayName ?? site.displayName,
        locale: snapshot.site.locale ?? site.locale,
        currency: snapshot.site.currency ?? site.currency,
        installedWixApps: snapshot.site.installedWixApps as Prisma.JsonArray,
        capabilities: detectWixCapabilities(snapshot.site.installedWixApps) as unknown as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });
    stages.push({
      key: "identity",
      label: "Confirmed Wix site identity",
      status: "done",
      detail: snapshot.site.displayName || snapshot.site.url || site.wixInstanceId,
    });
  } catch (error) {
    stages.push({
      key: "identity",
      label: "Confirmed Wix site identity",
      status: "failed",
      detail: error instanceof Error ? error.message : "Could not refresh Wix instance",
    });
    warnings.push("Wix identity refresh failed. Scanning the last known site URL.");
  }

  if (!siteUrl || !isSafeHttpUrl(siteUrl)) {
    warnings.push("This Wix site does not have a public URL yet. Wix APIs will still be read in plan scope if available.");
    stages.push({
      key: "homepage",
      label: "Read the live website",
      status: "skipped",
      detail: "No public URL — using Wix APIs only",
    });
  }

  const origin = siteUrl && isSafeHttpUrl(siteUrl)
    ? new URL(siteUrl.includes("://") ? siteUrl : `https://${siteUrl}`)
    : null;
  const homeUrl = origin ? origin.toString().replace(/\/$/, "") : siteUrl || "wix://site";
  const host = origin?.hostname ?? "";
  const pages: ExtractedPage[] = [];

  if (scope.includeDomainCrawl && origin && host) {
    const homepageHtml = await fetchText(homeUrl, host);
    if (!homepageHtml.ok) {
      warnings.push(`Homepage could not be crawled (${homepageHtml.reason}). Continuing with Wix APIs.`);
      stages.push({
        key: "homepage",
        label: "Read homepage and metadata",
        status: "failed",
        detail: homepageHtml.reason,
      });
    } else {
      const homepage = extractPage(homepageHtml.text, homeUrl, scope.maxCharsPerPage);
      pages.push(homepage);
      stages.push({
        key: "homepage",
        label: "Read homepage and metadata",
        status: "done",
        detail: homepage.title,
      });

      const sitemapXml = await fetchText(`${origin.origin}/sitemap.xml`, host);
      const sitemapUrls = sitemapXml.ok ? parseSitemapUrls(sitemapXml.text, host, scope.maxPages * 3) : [];
      stages.push({
        key: "sitemap",
        label: "Mapped site structure",
        status: sitemapXml.ok ? "done" : "skipped",
        detail: sitemapXml.ok ? `${sitemapUrls.length} URLs in sitemap` : "No sitemap.xml — following on-page links",
      });

      const discovered = unique([
        homeUrl,
        ...sitemapUrls,
        ...homepage.links.filter((link) => sameSite(link, host)),
      ])
        .filter((url) => isSafeHttpUrl(url) && sameSite(url, host))
        .sort((a, b) => pathPriority(a) - pathPriority(b) || a.length - b.length)
        .slice(0, scope.maxPages);

      const rest = discovered.slice(1);
      for (let i = 0; i < rest.length; i += 4) {
        const batch = await Promise.all(rest.slice(i, i + 4).map((url) => fetchText(url, host)));
        for (const [offset, page] of batch.entries()) {
          if (!page.ok) continue;
          pages.push(extractPage(page.text, rest[i + offset]!, scope.maxCharsPerPage));
        }
      }
      stages.push({
        key: "pages",
        label: `Crawled ${pages.length} page${pages.length === 1 ? "" : "s"} in ${scope.planLabel} scope`,
        status: "done",
        detail: discovered.length > pages.length ? `${discovered.length} discovered, ${pages.length} readable` : pages.map((page) => page.title).slice(0, 6).join(" · "),
      });
    }
  } else if (!scope.includeDomainCrawl) {
    skipped.push("Domain crawl is included after a paid plan is purchased.");
  }

  const apiHarvest = await harvestWixApis({
    wixInstanceId: input.wixInstanceId,
    siteUrl: homeUrl,
    scope,
  });
  pages.push(...apiHarvest.pages);
  const products = apiHarvest.products;
  stages.push(...apiHarvest.stages);
  skipped.push(...apiHarvest.skipped);
  warnings.push(...apiHarvest.warnings);

  if (!pages.length && !products.length) {
    warnings.push("No site, CMS, or catalog data could be read yet. Publish the Wix site and confirm app permissions.");
    return emptyResult(scope, homeUrl === "wix://site" ? null : homeUrl, stages, skipped, warnings);
  }

  const understanding = await understandSite({
    displayName: site.displayName || host || "Wix site",
    siteUrl: homeUrl,
    locale: site.locale,
    currency: site.currency,
    pages,
    products,
  });
  stages.push({
    key: "understand",
    label: "Built a business understanding",
    status: "done",
    detail: `${understanding.name} · ${understanding.industry} · ${understanding.confidence} confidence`,
  });

  const persisted = await persistScan({
    organizationId: input.organizationId,
    siteId: input.siteId,
    understanding,
    pages,
    products,
    knowledgeLimit: entitlements.knowledgeLimit,
  });
  stages.push({
    key: "knowledge",
    label: "Wrote verified knowledge for the AI employee",
    status: "done",
    detail: `${persisted.documents} documents · ${persisted.chunks} passages`,
  });

  return {
    ok: true,
    planKey: scope.planKey,
    planLabel: scope.planLabel,
    scopeNote: scope.depthNote,
    siteUrl: homeUrl,
    understanding,
    counts: {
      pages: pages.filter((page) => page.contentType === "PAGE" || page.contentType === "SERVICE").length,
      products: products.length,
      faqs: pages.filter((page) => page.contentType === "FAQ").length,
      policies: pages.filter((page) => page.contentType === "POLICY").length,
      chunks: persisted.chunks,
    },
    sources: [
      ...pages.map((page) => ({ title: page.title, url: page.url, type: page.contentType })),
      ...products.map((product) => ({
        title: product.name,
        url: homeUrl,
        type: "PRODUCT" as const,
      })),
    ].slice(0, 40),
    stages,
    skipped,
    warnings,
    analyzedAt: new Date().toISOString(),
  };
}

async function persistScan(input: {
  organizationId: string;
  siteId: string;
  understanding: SiteUnderstanding;
  pages: ExtractedPage[];
  products: { name: string; description?: string; price?: string; id?: string; data?: Prisma.InputJsonValue }[];
  knowledgeLimit: number;
}) {
  await prisma.businessProfile.upsert({
    where: { organizationId: input.organizationId },
    update: {
      siteId: input.siteId,
      name: input.understanding.name,
      businessType: input.understanding.businessType,
      industry: input.understanding.industry,
      businessModel: input.understanding.businessModel,
      summary: input.understanding.summary,
      structured: input.understanding as unknown as Prisma.InputJsonValue,
      analyzedAt: new Date(),
    },
    create: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      name: input.understanding.name,
      businessType: input.understanding.businessType,
      industry: input.understanding.industry,
      businessModel: input.understanding.businessModel,
      summary: input.understanding.summary,
      structured: input.understanding as unknown as Prisma.InputJsonValue,
      analyzedAt: new Date(),
    },
  });

  const stale = await prisma.knowledgeDocument.findMany({
    where: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      contentType: { not: "CUSTOM" },
    },
    select: { id: true },
  });
  if (stale.length) {
    await prisma.knowledgeDocument.deleteMany({
      where: { id: { in: stale.map((row) => row.id) }, organizationId: input.organizationId },
    });
  }

  const customCount = await prisma.knowledgeDocument.count({
    where: { organizationId: input.organizationId, contentType: "CUSTOM" },
  });
  const budget = Math.max(0, input.knowledgeLimit - customCount);

  const docs: {
    title: string;
    contentType: KnowledgeContentType;
    sourceUrl: string;
    cleanedContent: string;
  }[] = [
    ...input.pages.map((page) => ({
      title: page.title.slice(0, 180),
      contentType: page.contentType,
      sourceUrl: page.url,
      cleanedContent: [page.description, page.headings.join("\n"), page.text].filter(Boolean).join("\n\n"),
    })),
    ...input.products.map((product) => ({
      title: product.name.slice(0, 180),
      contentType: "PRODUCT" as const,
      sourceUrl: input.pages[0]?.url ?? "",
      cleanedContent: [product.name, product.price, product.description].filter(Boolean).join("\n"),
    })),
  ]
    .filter((doc) => doc.cleanedContent.trim().length > 40)
    .slice(0, budget);

  let chunks = 0;
  const embeddings: { index: number; vector: number[] }[] = [];
  const chunkPayloads: { docIndex: number; title: string; content: string; contentType: KnowledgeContentType; sourceUrl: string }[] = [];

  for (const [docIndex, doc] of docs.entries()) {
    const pieces = chunkText(doc.cleanedContent);
    for (const content of pieces) {
      chunkPayloads.push({
        docIndex,
        title: doc.title,
        content,
        contentType: doc.contentType,
        sourceUrl: doc.sourceUrl,
      });
    }
  }

  try {
    const ai = await getAIProvider();
    const batchSize = 16;
    for (let i = 0; i < chunkPayloads.length; i += batchSize) {
      const slice = chunkPayloads.slice(i, i + batchSize);
      const embedded = await ai.embed({ texts: slice.map((item) => item.content.slice(0, 4000)) });
      embedded.embeddings.forEach((vector, offset) => {
        if (vector?.length === 768) embeddings.push({ index: i + offset, vector });
      });
    }
  } catch {
    /* keyword-ready chunks still persist without vectors */
  }

  const embeddingByIndex = new Map(embeddings.map((item) => [item.index, item.vector]));

  for (const [docIndex, doc] of docs.entries()) {
    const document = await prisma.knowledgeDocument.create({
      data: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        title: doc.title,
        contentType: doc.contentType,
        sourceUrl: doc.sourceUrl,
        cleanedContent: doc.cleanedContent.slice(0, 20000),
        metadata: { origin: "site-scan" } as Prisma.InputJsonValue,
      },
    });

    const pieces = chunkPayloads
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.docIndex === docIndex);

    for (const piece of pieces) {
      const chunk = await prisma.knowledgeChunk.create({
        data: {
          organizationId: input.organizationId,
          siteId: input.siteId,
          documentId: document.id,
          content: piece.content,
          sourceUrl: piece.sourceUrl,
          title: piece.title,
          contentType: piece.contentType,
          metadata: { origin: "site-scan" } as Prisma.InputJsonValue,
        },
      });
      const vector = embeddingByIndex.get(piece.index);
      if (vector?.length === 768) {
        await prisma.$executeRawUnsafe(
          `UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2 AND "organizationId" = $3`,
          `[${vector.join(",")}]`,
          chunk.id,
          input.organizationId,
        );
      }
      chunks += 1;
    }
  }

  for (const product of input.products) {
    if (!product.id) continue;
    await prisma.product.upsert({
      where: {
        organizationId_wixProductId: {
          organizationId: input.organizationId,
          wixProductId: product.id,
        },
      },
      update: { name: product.name, data: product.data ?? {}, syncedAt: new Date(), siteId: input.siteId },
      create: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        wixProductId: product.id,
        name: product.name,
        data: product.data ?? {},
      },
    });
  }

  const source = await prisma.knowledgeSource.findFirst({
    where: { organizationId: input.organizationId, siteId: input.siteId, type: "site-scan" },
  });
  if (source) {
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: "ready", lastSyncedAt: new Date(), url: input.pages[0]?.url, title: input.understanding.name },
    });
  } else {
    await prisma.knowledgeSource.create({
      data: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        type: "site-scan",
        url: input.pages[0]?.url,
        title: input.understanding.name,
        status: "ready",
        lastSyncedAt: new Date(),
      },
    });
  }

  await prisma.wixSite.update({
    where: { id: input.siteId },
    data: { lastSyncedAt: new Date() },
  });

  return { documents: docs.length, chunks };
}

async function fetchText(
  url: string,
  siteHost: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; tidyAgent-SiteScanner/1.0; +https://agent.tidyflowapp.com)",
      },
    });
    clearTimeout(timer);
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    const finalUrl = response.url || url;
    if (!isSafeHttpUrl(finalUrl) || !sameSite(finalUrl, siteHost)) {
      return { ok: false, reason: "Blocked redirect" };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) return { ok: false, reason: "Page too large" };
    return { ok: true, text: buffer.toString("utf8") };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Fetch failed" };
  }
}

function emptyResult(
  scope: ScanScope,
  siteUrl: string | null,
  stages: ScanStage[],
  skipped: string[],
  warnings: string[],
): ScanResult {
  return {
    ok: false,
    planKey: scope.planKey,
    planLabel: scope.planLabel,
    scopeNote: scope.depthNote,
    siteUrl,
    understanding: null,
    counts: { pages: 0, products: 0, faqs: 0, policies: 0, chunks: 0 },
    sources: [],
    stages,
    skipped,
    warnings,
    analyzedAt: new Date().toISOString(),
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
