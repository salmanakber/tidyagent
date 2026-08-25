import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/settings";
import { shopifyGet } from "@/modules/shopify/client";
import { isShopifyPlatform } from "@/modules/platforms/types";
import type { ScanScope } from "@/modules/knowledge/scan-scope";
import { classifyPage, type ExtractedPage } from "@/modules/knowledge/extract";
import type { ScanStage } from "@/modules/knowledge/types";
import type { PlatformApiHarvest } from "@/modules/knowledge/webflow-sources";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function getShopifyCreds(siteId: string) {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isShopifyPlatform(site.platform) || !site.shopifyShopDomain) return null;
  const metadata = asRecord(site.credential?.metadata);
  const accessToken = decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) return null;
  return { site, shop: site.shopifyShopDomain, accessToken };
}

function money(amount?: string | number | null, currency?: string | null) {
  if (amount == null || amount === "") return undefined;
  const value = String(amount);
  return currency ? `${currency} ${value}` : value;
}

/**
 * Native Shopify Admin API harvest (shop, pages, products, blogs) + caller still runs public crawl.
 * Does not touch Wix or Webflow paths.
 */
export async function harvestShopifyApis(input: {
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

  const creds = await getShopifyCreds(input.siteId);
  if (!creds) {
    warnings.push("Shopify API token missing. Public storefront crawl still runs when a URL is available.");
    return { pages, products, stages, skipped, warnings };
  }

  if (input.scope.includeSiteProperties) {
    try {
      const payload = await shopifyGet<{ shop?: Record<string, unknown> }>(
        creds.shop,
        creds.accessToken,
        "/shop.json",
      );
      const shop = asRecord(payload.shop);
      displayName = String(shop.name || creds.shop);
      currency = shop.currency ? String(shop.currency) : null;
      locale = shop.primary_locale ? String(shop.primary_locale) : null;
      const domain = String(shop.domain || shop.myshopify_domain || creds.shop);
      siteUrl = domain.includes("://") ? domain : `https://${domain}`;
      const text = [
        displayName,
        siteUrl,
        shop.email ? `Email: ${shop.email}` : "",
        shop.phone ? `Phone: ${shop.phone}` : "",
        shop.address1 ? `Address: ${shop.address1}` : "",
        shop.city ? `City: ${shop.city}` : "",
        shop.country_name ? `Country: ${shop.country_name}` : "",
        currency ? `Currency: ${currency}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      pages.push({
        url: `${siteUrl}/#shop-profile`,
        title: displayName || "Store profile",
        description: "Store profile from Shopify",
        headings: [displayName || "Store"],
        text,
        emails: shop.email ? [String(shop.email)] : [],
        phones: shop.phone ? [String(shop.phone)] : [],
        links: [siteUrl],
        contentType: "PAGE",
        jsonLd: [],
        imageUrl: undefined,
      });
      stages.push({
        key: "shopify-shop",
        label: "Read Shopify store profile",
        status: "done",
        detail: displayName || creds.shop,
      });
    } catch (error) {
      stages.push({
        key: "shopify-shop",
        label: "Read Shopify store profile",
        status: "failed",
        detail: error instanceof Error ? error.message : "Shop profile unavailable",
      });
      warnings.push("Shopify shop profile could not be read. Public crawl still runs.");
    }
  }

  if (input.scope.includeCms) {
    try {
      const payload = await shopifyGet<{ pages?: Array<Record<string, unknown>> }>(
        creds.shop,
        creds.accessToken,
        `/pages.json?limit=${Math.min(250, input.scope.maxPages)}`,
      );
      for (const page of payload.pages ?? []) {
        const title = String(page.title || "Page");
        const handle = String(page.handle || page.id || "");
        const body = String(page.body_html || "").replace(/<[^>]+>/g, " ");
        const url = `${(siteUrl || `https://${creds.shop}`).replace(/\/$/, "")}/pages/${handle}`;
        const text = [title, body].filter(Boolean).join("\n\n");
        if (text.length < 12) continue;
        pages.push({
          url,
          title,
          description: String(page.summary_html || "").replace(/<[^>]+>/g, " ").slice(0, 240),
          headings: [title],
          text,
          emails: [],
          phones: [],
          links: [],
          contentType: classifyPage(url, title, text),
          jsonLd: [],
          imageUrl: undefined,
        });
      }
      stages.push({
        key: "shopify-pages",
        label: "Read Shopify pages",
        status: (payload.pages?.length ?? 0) ? "done" : "skipped",
        detail: payload.pages?.length ? `${payload.pages.length} pages` : "No Online Store pages",
      });
    } catch (error) {
      stages.push({
        key: "shopify-pages",
        label: "Read Shopify pages",
        status: "failed",
        detail: error instanceof Error ? error.message : "Pages unavailable",
      });
      warnings.push("Shopify pages could not be read.");
    }

    try {
      const blogs = await shopifyGet<{ blogs?: Array<{ id?: number; title?: string; handle?: string }> }>(
        creds.shop,
        creds.accessToken,
        "/blogs.json?limit=20",
      );
      let articleCount = 0;
      for (const blog of (blogs.blogs ?? []).slice(0, 8)) {
        if (!blog.id) continue;
        const articles = await shopifyGet<{ articles?: Array<Record<string, unknown>> }>(
          creds.shop,
          creds.accessToken,
          `/blogs/${blog.id}/articles.json?limit=${Math.min(50, input.scope.maxCmsItemsPerCollection)}`,
        ).catch(() => ({ articles: [] as Array<Record<string, unknown>> }));
        for (const article of articles.articles ?? []) {
          const title = String(article.title || "Article");
          const handle = String(article.handle || article.id || "");
          const body = String(article.body_html || "").replace(/<[^>]+>/g, " ");
          const url = `${(siteUrl || `https://${creds.shop}`).replace(/\/$/, "")}/blogs/${blog.handle || "news"}/${handle}`;
          const text = [title, body].filter(Boolean).join("\n\n");
          if (text.length < 20) continue;
          pages.push({
            url,
            title,
            description: String(article.summary_html || "").replace(/<[^>]+>/g, " ").slice(0, 240),
            headings: [title],
            text,
            emails: [],
            phones: [],
            links: [],
            contentType: classifyPage(url, title, text),
            jsonLd: [],
            imageUrl: undefined,
          });
          articleCount += 1;
        }
      }
      stages.push({
        key: "shopify-blogs",
        label: "Read Shopify blog articles",
        status: articleCount ? "done" : "skipped",
        detail: articleCount ? `${articleCount} articles` : "No blog articles",
      });
    } catch {
      stages.push({
        key: "shopify-blogs",
        label: "Read Shopify blog articles",
        status: "skipped",
        detail: "Blogs not available",
      });
    }
  } else {
    skipped.push("CMS / pages reading is included on paid plans.");
  }

  if (input.scope.includeStores) {
    try {
      let fetched = 0;
      let pageInfo: string | null = null;
      const limit = Math.min(250, input.scope.maxProducts);
      while (fetched < input.scope.maxProducts) {
        const path = pageInfo
          ? `/products.json?limit=${limit}&page_info=${encodeURIComponent(pageInfo)}`
          : `/products.json?limit=${limit}`;
        const payload = await shopifyGet<{ products?: Array<Record<string, unknown>> }>(
          creds.shop,
          creds.accessToken,
          path,
        );
        const batch = payload.products ?? [];
        if (!batch.length) break;
        for (const product of batch) {
          if (products.length >= input.scope.maxProducts) break;
          const title = String(product.title || "Product");
          const handle = String(product.handle || product.id || "");
          const body = String(product.body_html || "").replace(/<[^>]+>/g, " ");
          const variants = Array.isArray(product.variants) ? product.variants : [];
          const first = asRecord(variants[0]);
          const price = money(first.price as string | undefined, currency);
          const image = asRecord(Array.isArray(product.images) ? product.images[0] : product.image);
          const url = `${(siteUrl || `https://${creds.shop}`).replace(/\/$/, "")}/products/${handle}`;
          products.push({
            id: String(product.id || ""),
            name: title,
            description: body.slice(0, 4000),
            price,
            url,
            imageUrl: image.src ? String(image.src) : undefined,
            data: product as Prisma.InputJsonValue,
          });
        }
        fetched += batch.length;
        if (batch.length < limit) break;
        // REST page_info cursor not always returned without Link headers; stop after first page if no cursor.
        pageInfo = null;
        break;
      }
      stages.push({
        key: "shopify-products",
        label: "Read Shopify product catalog",
        status: products.length ? "done" : "skipped",
        detail: products.length ? `${products.length} products` : "No products in this store",
      });
    } catch (error) {
      stages.push({
        key: "shopify-products",
        label: "Read Shopify product catalog",
        status: "failed",
        detail: error instanceof Error ? error.message : "Products unavailable",
      });
      warnings.push("Shopify products could not be read.");
    }
  } else {
    skipped.push("Product catalog reading is included on Business and Pro.");
  }

  return { pages, products, stages, skipped, warnings, siteUrl, displayName, currency, locale };
}
