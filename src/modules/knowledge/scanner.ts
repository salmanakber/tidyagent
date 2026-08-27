import type { KnowledgeContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { fetchWixAppInstance } from "@/services/wix/client";
import { pathPriority, scanScopeFromConfig, type ScanScope } from "@/modules/knowledge/scan-scope";
import { getPlanScope } from "@/modules/billing/plan-scope-store";
import {
  chunkText,
  extractPage,
  guessServiceUrls,
  isSafeHttpUrl,
  parseRobotsSitemaps,
  parseSitemapIndex,
  parseSitemapUrls,
  sameSite,
  type ExtractedPage,
} from "@/modules/knowledge/extract";
import { harvestWixApis } from "@/modules/knowledge/wix-sources";
import { harvestWebflowApis } from "@/modules/knowledge/webflow-sources";
import { harvestShopifyApis } from "@/modules/knowledge/shopify-sources";
import { understandSite, type SiteUnderstanding } from "@/modules/knowledge/understand";
import { contentHash, factsFromPage, factsFromProduct } from "@/modules/knowledge/structured";
import { persistSiteFacts } from "@/modules/knowledge/fact-store";
import { getAIProvider } from "@/modules/ai/factory";
import { detectWixCapabilities } from "@/modules/wix/capabilities";
import { isShopifyPlatform, isWebflowPlatform, isWixPlatform, platformLabel } from "@/modules/platforms/types";
import { copyForPlatform } from "@/modules/platforms/copy";
import type { CrawlItem, ScanResult, ScanStage } from "@/modules/knowledge/types";
import type { PlatformApiHarvest } from "@/modules/knowledge/webflow-sources";

const FETCH_TIMEOUT_MS = 9000;
const MAX_BYTES = 900_000;
const CRAWL_BUDGET_MS = 90_000;
const DISCOVERY_CAP = 4000;

export async function scanOrganizationSite(input: {
  organizationId: string;
  siteId: string;
  wixInstanceId: string;
  fullSite?: boolean;
}): Promise<ScanResult> {
  const stages: ScanStage[] = [];
  const warnings: string[] = [];
  const skipped: string[] = [];

  const entitlements = await entitlementsForOrganization(input.organizationId);
  if (!entitlements.isPaidSeat) {
    throw new Error("A purchased plan is required before the site can be read.");
  }
  const planScope = await getPlanScope(entitlements.planKey);
  const scope: ScanScope = {
    ...scanScopeFromConfig(entitlements.planKey, planScope),
    fullSiteCrawl: input.fullSite !== false,
  };
  const site = await prisma.wixSite.findFirst({
    where: { id: input.siteId, organizationId: input.organizationId },
  });
  if (!site) {
    throw new Error("Site not found");
  }

  const wixSite = isWixPlatform(site.platform);
  const webflowSite = isWebflowPlatform(site.platform);
  const shopifySite = isShopifyPlatform(site.platform);
  const marketplace = platformLabel(site.platform);
  let siteUrl = site.url;
  if (wixSite) {
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
  } else {
    stages.push({
      key: "identity",
      label: `Confirmed ${marketplace} site identity`,
      status: siteUrl ? "done" : "skipped",
      detail: site.displayName || site.url || site.wixInstanceId,
    });
  }

  if (!siteUrl || !isSafeHttpUrl(siteUrl)) {
    if (wixSite) {
      warnings.push("This Wix site does not have a public URL yet. Wix APIs will still be read in plan scope if available.");
      stages.push({
        key: "homepage",
        label: "Read the live website",
        status: "skipped",
        detail: "No public URL — using Wix APIs only",
      });
    } else {
      warnings.push(`This ${marketplace} site does not have a public URL yet. Native APIs will still be read when available.`);
      stages.push({
        key: "homepage",
        label: "Read the live website",
        status: "skipped",
        detail: "No public URL — using platform APIs when available",
      });
    }
  }

  const origin = siteUrl && isSafeHttpUrl(siteUrl)
    ? new URL(siteUrl.includes("://") ? siteUrl : `https://${siteUrl}`)
    : null;
  const homeUrl = origin ? origin.toString().replace(/\/$/, "") : siteUrl || `${marketplace.toLowerCase()}://site`;
  const host = origin?.hostname ?? "";
  const pages: ExtractedPage[] = [];
  const crawl: CrawlItem[] = [];

  // Webflow Marketplace: knowledge must come from official Data APIs only — no public-site crawl/scrape.
  const allowDomainCrawl = scope.includeDomainCrawl && !webflowSite;
  if (allowDomainCrawl && origin && host) {
    const crawled = await crawlDomain(origin, host, scope);
    pages.push(...crawled.pages);
    crawl.push(...crawled.crawl);
    stages.push(...crawled.stages);
    warnings.push(...crawled.warnings);
  } else if (webflowSite) {
    skipped.push("Webflow sites use official Webflow Data APIs only (no public-site crawl).");
  } else if (!scope.includeDomainCrawl) {
    skipped.push("Domain crawl is included after a paid plan is purchased.");
  }

  let apiHarvest: PlatformApiHarvest;
  if (wixSite) {
    const wixHarvest = await harvestWixApis({
      wixInstanceId: input.wixInstanceId,
      siteUrl: homeUrl,
      scope,
    });
    apiHarvest = { ...wixHarvest, siteUrl: homeUrl };
  } else if (webflowSite) {
    apiHarvest = await harvestWebflowApis({
      siteId: site.id,
      siteUrl: homeUrl,
      scope,
    });
  } else if (shopifySite) {
    apiHarvest = await harvestShopifyApis({
      siteId: site.id,
      siteUrl: homeUrl,
      scope,
    });
  } else {
    apiHarvest = { pages: [], products: [], stages: [], skipped: [], warnings: [] };
  }

  if (apiHarvest.siteUrl || apiHarvest.displayName || apiHarvest.currency || apiHarvest.locale) {
    await prisma.wixSite.update({
      where: { id: site.id },
      data: {
        ...(apiHarvest.siteUrl ? { url: apiHarvest.siteUrl } : {}),
        ...(apiHarvest.displayName ? { displayName: apiHarvest.displayName } : {}),
        ...(apiHarvest.currency ? { currency: apiHarvest.currency } : {}),
        ...(apiHarvest.locale ? { locale: apiHarvest.locale } : {}),
        ...(apiHarvest.products.length
          ? {
              capabilities: {
                hasStores: true,
                hasBookings: false,
                source: webflowSite ? "webflow" : shopifySite ? "shopify" : "scan",
              } as Prisma.InputJsonValue,
            }
          : {}),
        lastSyncedAt: new Date(),
      },
    });
  }

  pages.push(...apiHarvest.pages);
  const products = apiHarvest.products;
  stages.push(...apiHarvest.stages);
  skipped.push(...apiHarvest.skipped);
  warnings.push(...apiHarvest.warnings);

  const apiOrigin = (pageUrl: string): CrawlItem["origin"] => {
    if (wixSite) return pageUrl.includes("/cms/") ? "wix-cms" : "wix-site";
    if (webflowSite) return pageUrl.includes("/cms/") || pageUrl.includes("#site-profile") ? "webflow-cms" : "webflow-site";
    if (shopifySite) return pageUrl.includes("/blogs/") || pageUrl.includes("/pages/") || pageUrl.includes("#shop-profile")
      ? "shopify-cms"
      : "shopify-site";
    return "website";
  };
  const storeOrigin: CrawlItem["origin"] = wixSite
    ? "wix-store"
    : webflowSite
      ? "webflow-store"
      : shopifySite
        ? "shopify-store"
        : "website";

  crawl.push(
    ...apiHarvest.pages.map((page) => ({
      url: page.url,
      title: page.title,
      contentType: page.contentType,
      status: "crawled" as const,
      origin: apiOrigin(page.url),
    })),
    ...products.map((product) => ({
      url: product.url || `${homeUrl}/product/${product.id || product.name}`,
      title: product.price ? `${product.name} — ${product.price}` : product.name,
      contentType: "PRODUCT",
      status: "crawled" as const,
      origin: storeOrigin,
    })),
  );

  const pricesDoc = pricesCatalogPage(pages, products, homeUrl);
  const resolvedHome = apiHarvest.siteUrl && isSafeHttpUrl(apiHarvest.siteUrl)
    ? apiHarvest.siteUrl.replace(/\/$/, "")
    : homeUrl;

  if (!pages.length && !products.length) {
    warnings.push(
      wixSite
        ? "No site, CMS, or catalog data could be read yet. Publish the Wix site and confirm app permissions."
        : `No public pages or catalog data could be read yet. Publish the ${marketplace} site and try again.`,
    );
    return emptyResult(scope, resolvedHome.includes("://site") ? null : resolvedHome, stages, skipped, warnings);
  }

  const understanding = await understandSite({
    displayName: apiHarvest.displayName || site.displayName || host || `${marketplace} site`,
    siteUrl: resolvedHome,
    locale: apiHarvest.locale || site.locale,
    currency: apiHarvest.currency || site.currency,
    pages,
    products,
  });
  stages.push({
    key: "understand",
    label: "Built a business understanding",
    status: "done",
    detail: `${understanding.name} · ${understanding.industry} · ${understanding.confidence} confidence`,
  });

  if (pricesDoc) pages.push(pricesDoc);

  const persisted = await persistScan({
    organizationId: input.organizationId,
    siteId: input.siteId,
    understanding,
    pages,
    products,
    knowledgeLimit: entitlements.knowledgeLimit,
    crawl,
    pagesDiscovered: crawl.filter((item) => item.origin === "website").length,
    pagesCrawled: crawl.filter((item) => item.origin === "website" && item.status === "crawled").length,
    pagesFailed: crawl.filter((item) => item.status === "failed").length,
    storeOrigin,
    catalogExtractionMethod: wixSite ? "wix-api" : webflowSite ? "webflow-api" : shopifySite ? "shopify-api" : "http",
  });
  stages.push({
    key: "knowledge",
    label: "Wrote verified knowledge for the AI employee",
    status: "done",
    detail: `${persisted.documents} documents · ${persisted.chunks} passages · ${persisted.facts} facts`,
  });
  if (persisted.conflicts) {
    stages.push({
      key: "conflicts",
      label: "Knowledge conflicts",
      status: "failed",
      detail: `${persisted.conflicts} facts disagree across pages — review them in Knowledge before the AI states a number`,
    });
  }

  return {
    ok: true,
    planKey: scope.planKey,
    planLabel: scope.planLabel,
    scopeNote: copyForPlatform(site.platform, scope.depthNote),
    siteUrl: resolvedHome,
    understanding,
    counts: {
      pages: crawl.filter((item) => item.origin === "website" && item.status === "crawled").length,
      products: products.length,
      faqs: pages.filter((page) => page.contentType === "FAQ").length,
      policies: pages.filter((page) => page.contentType === "POLICY").length,
      chunks: persisted.chunks,
      facts: persisted.facts,
      conflicts: persisted.conflicts,
    },
    sources: [
      ...pages.map((page) => ({ title: page.title, url: page.url, type: page.contentType })),
      ...products.map((product) => ({
        title: product.name,
        url: product.url || resolvedHome,
        type: "PRODUCT" as const,
      })),
    ],
    crawl,
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
  products: { name: string; description?: string; price?: string; id?: string; url?: string; imageUrl?: string; data?: Prisma.InputJsonValue }[];
  knowledgeLimit: number;
  crawl: CrawlItem[];
  pagesDiscovered?: number;
  pagesCrawled?: number;
  pagesFailed?: number;
  storeOrigin?: CrawlItem["origin"];
  catalogExtractionMethod?: string;
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

  const pageDocs = input.pages.map((page) => ({
    title: page.title.slice(0, 180),
    contentType: page.contentType,
    sourceUrl: page.url,
    cleanedContent: [page.description, page.headings.join("\n"), page.text].filter(Boolean).join("\n\n"),
    extractionMethod: "http",
    metadata: {
      origin: "site-scan",
      imageUrl: page.imageUrl || null,
      name: page.title,
    },
  }));
  const productDocs = input.products.map((product) => ({
    title: product.price ? `${product.name} — ${product.price}`.slice(0, 180) : product.name.slice(0, 180),
    contentType: "PRODUCT" as const,
    sourceUrl: product.url || input.pages[0]?.url || "",
    cleanedContent: [product.name, product.price ? `Price: ${product.price}` : "", product.url, product.description]
      .filter(Boolean)
      .join("\n"),
    extractionMethod: input.catalogExtractionMethod || "wix-api",
    metadata: {
      origin: input.storeOrigin || "wix-store",
      name: product.name,
      price: product.price || null,
      imageUrl: product.imageUrl || null,
      url: product.url || null,
    },
  }));
  const docs = [...productDocs, ...pageDocs]
    .filter((doc) => doc.cleanedContent.trim().length > (doc.contentType === "PRODUCT" ? 2 : 24))
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
    const embedLimit = Math.min(chunkPayloads.length, 400);
    for (let i = 0; i < embedLimit; i += batchSize) {
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

  const createdDocs: { id: string; sourceUrl: string | null }[] = [];
  for (const [docIndex, doc] of docs.entries()) {
    const document = await prisma.knowledgeDocument.create({
      data: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        title: doc.title,
        contentType: doc.contentType,
        sourceUrl: doc.sourceUrl,
        cleanedContent: doc.cleanedContent.slice(0, 20000),
        metadata: ("metadata" in doc && doc.metadata
          ? doc.metadata
          : { origin: input.storeOrigin || (doc.extractionMethod?.includes("api") ? "wix-store" : "site-scan") }) as Prisma.InputJsonValue,
        contentHash: contentHash(doc.cleanedContent),
        extractionMethod: doc.extractionMethod,
      },
    });
    createdDocs.push({ id: document.id, sourceUrl: document.sourceUrl });

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
  const extractedFacts = [
    ...input.pages.flatMap((page) => factsFromPage(page)),
    ...input.products.flatMap((product) => factsFromProduct({ name: product.name, price: product.price, url: product.url, description: product.description })),
  ];
  const crawlVersion = (source?.crawlVersion ?? 0) + 1;
  const storedFacts = await persistSiteFacts({
    organizationId: input.organizationId,
    siteId: input.siteId,
    facts: extractedFacts,
    documents: createdDocs,
    crawlVersion,
  });

  if (source) {
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: {
        status: "ready",
        lastSyncedAt: new Date(),
        url: input.pages[0]?.url,
        title: input.understanding.name,
        pagesDiscovered: input.pagesDiscovered ?? input.crawl.filter((item) => item.origin === "website").length,
        pagesCrawled: input.pagesCrawled ?? input.crawl.filter((item) => item.origin === "website" && item.status === "crawled").length,
        pagesFailed: input.pagesFailed ?? 0,
        crawlVersion,
        lastError: null,
        metadata: { crawl: input.crawl } as Prisma.InputJsonValue,
      },
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
        pagesDiscovered: input.pagesDiscovered ?? input.crawl.filter((item) => item.origin === "website").length,
        pagesCrawled: input.pagesCrawled ?? input.crawl.filter((item) => item.origin === "website" && item.status === "crawled").length,
        pagesFailed: input.pagesFailed ?? 0,
        crawlVersion,
        metadata: { crawl: input.crawl } as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.wixSite.update({
    where: { id: input.siteId },
    data: { lastSyncedAt: new Date() },
  });

  return { documents: docs.length, chunks, facts: storedFacts.facts, conflicts: storedFacts.conflicts };
}

function pricesCatalogPage(
  pages: ExtractedPage[],
  products: { name: string; price?: string; url?: string }[],
  homeUrl: string,
): ExtractedPage | null {
  const fromPages = pages
    .map((page) => {
      const start = page.text.indexOf("PRICES AND ITEMS FROM THIS PAGE:");
      if (start < 0) return "";
      const block = page.text.slice(start, start + 2200);
      if (!/\$|USD|EUR|GBP|PKR|£|€/.test(block)) return "";
      return `${page.title} (${page.url})\n${block}`;
    })
    .filter(Boolean);
  const fromProducts = products
    .filter((item) => item.price)
    .map((item) => `${item.name} — ${item.price}${item.url ? ` — ${item.url}` : ""}`);
  const text = [...fromPages, fromProducts.length ? `CATALOG:\n${fromProducts.join("\n")}` : ""].filter(Boolean).join("\n\n");
  if (text.length < 24) return null;
  return {
    url: `${homeUrl.replace(/\/$/, "")}/#prices`,
    title: "Prices and offerings",
    description: "Verified prices and named items from the live site and catalog.",
    headings: ["Prices and offerings"],
    text: text.slice(0, 20000),
    emails: [],
    phones: [],
    links: pages.map((page) => page.url).slice(0, 20),
    contentType: "SERVICE",
    jsonLd: [],
  };
}

async function crawlDomain(origin: URL, host: string, scope: ScanScope) {
  const pages: ExtractedPage[] = [];
  const stages: ScanStage[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const failed = new Map<string, string>();
  const queue: string[] = [];
  const fullSite = scope.fullSiteCrawl !== false;
  const discoveryCap = Math.min(DISCOVERY_CAP, Math.max(scope.maxPages * 20, 400));
  const started = Date.now();

  const enqueue = (raw: string) => {
    if (seen.size >= discoveryCap) return;
    if (!isSafeHttpUrl(raw) || !sameSite(raw, host)) return;
    let url = raw;
    try {
      const parsed = new URL(raw);
      parsed.hash = "";
      url = parsed.toString().replace(/\/$/, "") || parsed.origin;
    } catch {
      return;
    }
    if (seen.has(url) || /\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|mp3)(\?|$)/i.test(url)) return;
    seen.add(url);
    queue.push(url);
  };

  const homeUrl = origin.toString().replace(/\/$/, "");
  enqueue(homeUrl);

  const sitemapSeeds = [
    `${origin.origin}/sitemap.xml`,
    `${origin.origin}/sitemap_index.xml`,
    `${origin.origin}/pages-sitemap.xml`,
    `${origin.origin}/products-sitemap.xml`,
    `${origin.origin}/store-sitemap.xml`,
    `${origin.origin}/blog-sitemap.xml`,
  ];
  const robots = await fetchText(`${origin.origin}/robots.txt`, host);
  if (robots.ok) {
    for (const url of parseRobotsSitemaps(robots.text, host)) sitemapSeeds.push(url);
  }

  let sitemapCount = 0;
  for (const seed of unique(sitemapSeeds)) {
    const xml = await fetchText(seed, host);
    if (!xml.ok) continue;
    const nested = parseSitemapIndex(xml.text, host, 40);
    for (const child of nested) {
      const childXml = await fetchText(child, host);
      if (!childXml.ok) continue;
      for (const url of parseSitemapUrls(childXml.text, host, discoveryCap)) enqueue(url);
      sitemapCount += 1;
    }
    for (const url of parseSitemapUrls(xml.text, host, discoveryCap)) enqueue(url);
    sitemapCount += 1;
  }
  stages.push({
    key: "sitemap",
    label: "Mapped site structure",
    status: sitemapCount ? "done" : "skipped",
    detail: sitemapCount ? `${seen.size} URLs discovered from sitemaps and robots.txt` : "No sitemap — following on-page links",
  });

  queue.sort((a, b) => pathPriority(a) - pathPriority(b) || a.length - b.length);

  const homepage = await fetchText(homeUrl, host);
  if (!homepage.ok) {
    failed.set(homeUrl, homepage.reason);
    warnings.push(`Homepage could not be crawled (${homepage.reason}). Continuing with catalog APIs and other pages.`);
    stages.push({ key: "homepage", label: "Read homepage and metadata", status: "failed", detail: homepage.reason });
  } else {
    const page = extractPage(homepage.text, homeUrl, scope.maxCharsPerPage);
    pages.push(page);
    for (const link of page.links) enqueue(link);
    for (const link of guessServiceUrls(homeUrl, page.headings, page.text)) enqueue(link);
    stages.push({ key: "homepage", label: "Read homepage and metadata", status: "done", detail: page.title });
  }

  while (queue.length && pages.length < scope.maxPages && Date.now() - started < CRAWL_BUDGET_MS) {
    if (!fullSite) {
      queue.sort((a, b) => pathPriority(a) - pathPriority(b) || a.length - b.length);
    }
    const batchUrls = queue.splice(0, 5).filter((url) => !pages.some((page) => page.url === url));
    if (!batchUrls.length) continue;
    const batch = await Promise.all(batchUrls.map(async (url) => ({ url, result: await fetchText(url, host) })));
    for (const item of batch) {
      if (pages.length >= scope.maxPages) break;
      if (!item.result.ok) {
        failed.set(item.url, item.result.reason);
        continue;
      }
      const page = extractPage(item.result.text, item.url, scope.maxCharsPerPage);
      pages.push(page);
      for (const link of page.links) enqueue(link);
      for (const link of guessServiceUrls(homeUrl, page.headings, page.text)) enqueue(link);
    }
  }

  const crawled = new Map(pages.map((page) => [page.url, page]));
  const crawl: CrawlItem[] = [...seen].map((url) => {
    const page = crawled.get(url);
    if (page) {
      return { url, title: page.title, contentType: page.contentType, status: "crawled", origin: "website" };
    }
    if (failed.has(url)) {
      return { url, title: url, contentType: "PAGE", status: "failed", origin: "website" };
    }
    return { url, title: url, contentType: "PAGE", status: "discovered", origin: "website" };
  });

  const leftover = crawl.filter((item) => item.status !== "crawled").length;
  stages.push({
    key: "pages",
    label: `Crawled ${pages.length} of ${seen.size} discovered page${seen.size === 1 ? "" : "s"}`,
    status: "done",
    detail: leftover
      ? `${leftover} found but not read yet (plan cap or time). They are listed in Knowledge.`
      : pages.map((page) => page.title).slice(0, 6).join(" · "),
  });

  return { pages, crawl, stages, warnings };
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
    counts: { pages: 0, products: 0, faqs: 0, policies: 0, chunks: 0, facts: 0, conflicts: 0 },
    sources: [],
    crawl: [],
    stages,
    skipped,
    warnings,
    analyzedAt: new Date().toISOString(),
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
