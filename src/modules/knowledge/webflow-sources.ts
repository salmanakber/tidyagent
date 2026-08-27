import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/settings";
import { firstImageUrl } from "@/modules/knowledge/media";
import { webflowGet } from "@/modules/webflow/client";
import { sitePublicUrl, type WebflowSiteRecord } from "@/modules/webflow/sites";
import { isWebflowPlatform } from "@/modules/platforms/types";
import type { ScanScope } from "@/modules/knowledge/scan-scope";
import { classifyPage, type ExtractedPage } from "@/modules/knowledge/extract";
import type { ScanStage } from "@/modules/knowledge/types";

export type PlatformApiHarvest = {
  pages: ExtractedPage[];
  products: {
    name: string;
    description?: string;
    price?: string;
    id?: string;
    url?: string;
    imageUrl?: string;
    data?: Prisma.InputJsonValue;
  }[];
  stages: ScanStage[];
  skipped: string[];
  warnings: string[];
  siteUrl?: string | null;
  displayName?: string | null;
  currency?: string | null;
  locale?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fieldText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(fieldText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.text === "string") return row.text;
    if (typeof row.url === "string") return row.url;
    if (typeof row.alt === "string") return row.alt;
    return Object.values(row).map(fieldText).filter(Boolean).join("\n");
  }
  return "";
}

async function getWebflowCreds(siteId: string) {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isWebflowPlatform(site.platform) || !site.webflowSiteId) return null;
  const metadata = asRecord(site.credential?.metadata);
  const accessToken = decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) return null;
  return { site, webflowSiteId: site.webflowSiteId, accessToken };
}

/**
 * Native Webflow Data API harvest (site, pages, CMS, ecommerce).
 * Domain crawl is never used for Webflow (Marketplace Data access rules).
 */
export async function harvestWebflowApis(input: {
  siteId: string;
  siteUrl: string;
  scope: ScanScope;
}): Promise<PlatformApiHarvest> {
  const pages: ExtractedPage[] = [];
  const products: PlatformApiHarvest["products"] = [];
  const stages: ScanStage[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  let siteUrl = input.siteUrl;
  let displayName: string | null = null;
  let currency: string | null = null;
  let locale: string | null = null;

  const creds = await getWebflowCreds(input.siteId);
  if (!creds) {
    warnings.push("Webflow API token missing. Reconnect the app from Webflow to refresh Data API access.");
    return { pages, products, stages, skipped, warnings };
  }

  if (input.scope.includeSiteProperties) {
    try {
      const site = await webflowGet<WebflowSiteRecord>(creds.accessToken, `/v2/sites/${creds.webflowSiteId}`);
      displayName = site.displayName || site.shortName || null;
      siteUrl = sitePublicUrl(site) || siteUrl;
      const text = [
        displayName,
        siteUrl,
        site.shortName ? `Webflow site: ${site.shortName}` : "",
        site.lastPublished ? `Last published: ${site.lastPublished}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      pages.push({
        url: `${siteUrl || input.siteUrl}/#site-profile`,
        title: displayName || "Site profile",
        description: "Site profile from Webflow",
        headings: [displayName || "Site"].filter(Boolean),
        text,
        emails: [],
        phones: [],
        links: siteUrl ? [siteUrl] : [],
        contentType: "PAGE",
        jsonLd: [],
        imageUrl: undefined,
      });
      stages.push({
        key: "webflow-site",
        label: "Read Webflow site profile",
        status: "done",
        detail: displayName || siteUrl || creds.webflowSiteId,
      });
    } catch (error) {
      stages.push({
        key: "webflow-site",
        label: "Read Webflow site profile",
        status: "failed",
        detail: error instanceof Error ? error.message : "Site profile unavailable",
      });
      warnings.push("Webflow site profile could not be read. Check sites:read permission and reconnect if needed.");
    }
  }

  if (input.scope.includeCms) {
    try {
      const listed = await webflowGet<{ pages?: Array<Record<string, unknown>> }>(
        creds.accessToken,
        `/v2/sites/${creds.webflowSiteId}/pages`,
      );
      const apiPages = listed.pages ?? [];
      for (const page of apiPages.slice(0, input.scope.maxPages)) {
        const title = String(page.title || page.seoTitle || page.slug || "Page");
        const slug = String(page.slug || page.id || "");
        const publishedPath = String(page.publishedPath || (slug ? `/${slug}` : ""));
        const url = siteUrl
          ? `${siteUrl.replace(/\/$/, "")}${publishedPath.startsWith("/") ? publishedPath : `/${publishedPath}`}`
          : `webflow://page/${page.id}`;
        const seoDesc = String(page.seoDescription || page.description || "");
        const body = [title, seoDesc, publishedPath].filter(Boolean).join("\n\n");
        if (body.length < 8) continue;
        pages.push({
          url,
          title,
          description: seoDesc,
          headings: [title],
          text: body,
          emails: [],
          phones: [],
          links: [],
          contentType: classifyPage(url, title, body),
          jsonLd: [],
          imageUrl: undefined,
        });
      }
      stages.push({
        key: "webflow-pages",
        label: "Read Webflow pages",
        status: apiPages.length ? "done" : "skipped",
        detail: apiPages.length ? `${Math.min(apiPages.length, input.scope.maxPages)} pages from Webflow` : "No pages listed",
      });
    } catch (error) {
      stages.push({
        key: "webflow-pages",
        label: "Read Webflow pages",
        status: "failed",
        detail: error instanceof Error ? error.message : "Pages unavailable",
      });
      warnings.push("Webflow pages API could not be read.");
    }

    try {
      const collections = await webflowGet<{ collections?: Array<{ id?: string; displayName?: string; slug?: string }> }>(
        creds.accessToken,
        `/v2/sites/${creds.webflowSiteId}/collections`,
      );
      const list = (collections.collections ?? []).slice(0, input.scope.maxCmsCollections);
      let itemCount = 0;
      for (const collection of list) {
        if (!collection.id) continue;
        const items = await webflowGet<{ items?: Array<Record<string, unknown>> }>(
          creds.accessToken,
          `/v2/collections/${collection.id}/items`,
        ).catch(() => ({ items: [] as Array<Record<string, unknown>> }));
        for (const item of (items.items ?? []).slice(0, input.scope.maxCmsItemsPerCollection)) {
          const fieldData = asRecord(item.fieldData);
          const name = String(fieldData.name || fieldData.title || item.id || "CMS item");
          const slug = String(fieldData.slug || "");
          const text = Object.entries(fieldData)
            .map(([key, value]) => `${key}: ${fieldText(value)}`)
            .filter((line) => line.length > 3)
            .join("\n");
          if (text.length < 12) continue;
          const url = siteUrl && slug
            ? `${siteUrl.replace(/\/$/, "")}/${collection.slug || "cms"}/${slug}`
            : `${siteUrl || input.siteUrl}/cms/${collection.id}/${item.id}`;
          pages.push({
            url,
            title: `${collection.displayName || "CMS"} · ${name}`.slice(0, 180),
            description: name,
            headings: [name],
            text,
            emails: [],
            phones: [],
            links: [],
            contentType: classifyPage(url, name, text),
            jsonLd: [],
            imageUrl: undefined,
          });
          itemCount += 1;
        }
      }
      stages.push({
        key: "webflow-cms",
        label: "Read Webflow CMS",
        status: itemCount ? "done" : "skipped",
        detail: itemCount ? `${itemCount} CMS items` : "No CMS items in plan scope",
      });
    } catch (error) {
      stages.push({
        key: "webflow-cms",
        label: "Read Webflow CMS",
        status: "failed",
        detail: error instanceof Error ? error.message : "CMS unavailable",
      });
      warnings.push("Webflow CMS could not be read.");
    }
  } else {
    skipped.push("CMS reading is included on paid plans.");
  }

  if (input.scope.includeStores) {
    try {
      const listed = await webflowGet<{
        items?: Array<Record<string, unknown>>;
        products?: Array<Record<string, unknown>>;
      }>(creds.accessToken, `/v2/sites/${creds.webflowSiteId}/products`);
      const rows = listed.items ?? listed.products ?? [];
      for (const row of rows.slice(0, input.scope.maxProducts)) {
        const product = asRecord(row.product ?? row);
        const fieldData = asRecord(product.fieldData);
        const name = String(fieldData.name || product.name || row.id || "Product");
        const slug = String(fieldData.slug || product.slug || "");
        const description = fieldText(fieldData.description || product.description);
        const skus = Array.isArray(row.skus) ? row.skus : [];
        const firstSku = asRecord(skus[0]);
        const priceObj = asRecord(firstSku.price ?? product.price);
        const amount = priceObj.value ?? priceObj.amount ?? priceObj.unit;
        const price =
          amount != null
            ? `${priceObj.unit || priceObj.currency || currency || ""} ${amount}`.trim()
            : undefined;
        const url = siteUrl && slug ? `${siteUrl.replace(/\/$/, "")}/product/${slug}` : undefined;
        const imageUrl =
          firstImageUrl(
            fieldData.image,
            fieldData.mainImage,
            fieldData.thumbnail,
            product.image,
            asRecord(skus[0])?.image,
            asRecord(asRecord(skus[0])?.fieldData)?.image,
          ) || undefined;
        products.push({
          id: String(product.id || row.id || ""),
          name,
          description,
          price,
          url,
          imageUrl,
          data: row as Prisma.InputJsonValue,
        });
      }
      stages.push({
        key: "webflow-store",
        label: "Read Webflow ecommerce catalog",
        status: products.length ? "done" : "skipped",
        detail: products.length ? `${products.length} products` : "No ecommerce products on this site",
      });
    } catch (error) {
      stages.push({
        key: "webflow-store",
        label: "Read Webflow ecommerce catalog",
        status: "skipped",
        detail: error instanceof Error ? error.message : "Ecommerce not available on this site",
      });
    }
  } else {
    skipped.push("Ecommerce catalog reading is included on paid plans.");
  }

  return { pages, products, stages, skipped, warnings, siteUrl, displayName, currency, locale };
}
