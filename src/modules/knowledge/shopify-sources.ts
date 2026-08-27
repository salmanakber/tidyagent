import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/settings";
import { shopifyGraphql, ShopifyApiError } from "@/modules/shopify/client";
import { normalizeShopifyShop, shopPublicUrl } from "@/modules/shopify/shop";
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

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function money(amount?: string | number | null, currency?: string | null) {
  if (amount == null || amount === "") return undefined;
  const value = String(amount);
  return currency ? `${currency} ${value}` : value;
}

function errorDetail(error: unknown) {
  if (error instanceof ShopifyApiError) {
    return error.status ? `${error.message} (HTTP ${error.status})` : error.message;
  }
  return error instanceof Error ? error.message : "Unavailable";
}

async function getShopifyCreds(siteId: string) {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isShopifyPlatform(site.platform) || !site.shopifyShopDomain) return null;
  const shop = normalizeShopifyShop(site.shopifyShopDomain) || site.shopifyShopDomain;
  const metadata = asRecord(site.credential?.metadata);
  const accessToken = decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) return null;
  return { site, shop, accessToken };
}

type GqlMoney = { amount?: string; currencyCode?: string };
type GqlImage = { url?: string; altText?: string | null };
type GqlVariant = {
  id?: string;
  title?: string;
  sku?: string | null;
  price?: string;
  compareAtPrice?: string | null;
  availableForSale?: boolean;
  selectedOptions?: Array<{ name?: string; value?: string }>;
  image?: GqlImage | null;
};
type GqlProduct = {
  id?: string;
  title?: string;
  handle?: string;
  status?: string;
  descriptionHtml?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  onlineStoreUrl?: string | null;
  featuredImage?: GqlImage | null;
  images?: { edges?: Array<{ node?: GqlImage | null }> };
  priceRangeV2?: { minVariantPrice?: GqlMoney; maxVariantPrice?: GqlMoney };
  variants?: { edges?: Array<{ node?: GqlVariant | null }> };
};

function productImageUrls(product: GqlProduct): string[] {
  const urls: string[] = [];
  const push = (url?: string | null) => {
    if (!url || urls.includes(url)) return;
    urls.push(url);
  };
  push(product.featuredImage?.url);
  for (const edge of product.images?.edges ?? []) push(edge.node?.url);
  for (const edge of product.variants?.edges ?? []) push(edge.node?.image?.url);
  return urls;
}

function productPriceLabel(product: GqlProduct, fallbackCurrency?: string | null) {
  const min = product.priceRangeV2?.minVariantPrice;
  const max = product.priceRangeV2?.maxVariantPrice;
  if (min?.amount) {
    const currency = min.currencyCode || fallbackCurrency;
    if (max?.amount && max.amount !== min.amount) {
      return `${money(min.amount, currency)} – ${money(max.amount, max.currencyCode || currency)}`;
    }
    return money(min.amount, currency);
  }
  const first = product.variants?.edges?.[0]?.node;
  return money(first?.price, fallbackCurrency);
}

function productTrainingText(input: {
  title: string;
  url: string;
  product: GqlProduct;
  price?: string;
  currency?: string | null;
}) {
  const { title, url, product, price, currency } = input;
  const body = stripHtml(String(product.descriptionHtml || ""));
  const variants = (product.variants?.edges ?? [])
    .map((edge) => edge.node)
    .filter(Boolean) as GqlVariant[];
  const variantLines = variants.map((variant) => {
    const options = (variant.selectedOptions ?? [])
      .map((opt) => `${opt.name || "Option"}: ${opt.value || ""}`)
      .filter((line) => !line.endsWith(": "))
      .join(", ");
    const parts = [
      variant.title && variant.title !== "Default Title" ? variant.title : null,
      options || null,
      money(variant.price, currency) ? `price ${money(variant.price, currency)}` : null,
      variant.compareAtPrice ? `compare-at ${money(variant.compareAtPrice, currency)}` : null,
      variant.sku ? `SKU ${variant.sku}` : null,
      variant.availableForSale === false ? "out of stock" : variant.availableForSale ? "in stock" : null,
    ].filter(Boolean);
    return `- ${parts.join(" · ")}`;
  });
  const images = productImageUrls(product);

  return [
    title,
    price ? `Price: ${price}` : "",
    `Product URL: ${url}`,
    product.vendor ? `Vendor: ${product.vendor}` : "",
    product.productType ? `Product type: ${product.productType}` : "",
    product.tags?.length ? `Tags: ${product.tags.join(", ")}` : "",
    product.status ? `Status: ${product.status}` : "",
    variantLines.length ? `Variants:\n${variantLines.join("\n")}` : "",
    images.length ? `Images:\n${images.map((src) => `- ${src}`).join("\n")}` : "",
    body,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Shopify App Store + API Terms: knowledge must come from Admin APIs (GraphQL),
 * not storefront scraping. Public domain crawl is disabled for Shopify sites.
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
    warnings.push("Shopify API token missing. Reconnect the Shopify app, then scan again.");
    return { pages, products, stages, skipped, warnings };
  }

  if (input.scope.includeSiteProperties) {
    try {
      const data = await shopifyGraphql<{
        shop?: {
          name?: string;
          contactEmail?: string | null;
          email?: string | null;
          description?: string | null;
          currencyCode?: string | null;
          primaryLocale?: string | null;
          myshopifyDomain?: string | null;
          url?: string | null;
          primaryDomain?: { url?: string | null; host?: string | null } | null;
          shopAddress?: {
            address1?: string | null;
            city?: string | null;
            country?: string | null;
            phone?: string | null;
          } | null;
          shopPolicies?: Array<{
            type?: string | null;
            title?: string | null;
            body?: string | null;
            url?: string | null;
          } | null>;
        };
      }>(
        creds.shop,
        creds.accessToken,
        `#graphql
        query ShopifyShopProfile {
          shop {
            name
            contactEmail
            description
            currencyCode
            primaryLocale
            myshopifyDomain
            url
            primaryDomain { url host }
            shopAddress { address1 city country phone }
            shopPolicies { type title body url }
          }
        }`,
      );
      const shop = data.shop ?? {};
      displayName = String(shop.name || creds.shop);
      currency = shop.currencyCode ? String(shop.currencyCode) : null;
      locale = shop.primaryLocale ? String(shop.primaryLocale) : null;
      siteUrl = shopPublicUrl(
        creds.shop,
        shop.myshopifyDomain,
        shop.primaryDomain?.url || shop.primaryDomain?.host || shop.url,
      );
      const email = shop.contactEmail || shop.email || "";
      const phone = shop.shopAddress?.phone || "";
      const text = [
        displayName,
        siteUrl,
        shop.description ? stripHtml(String(shop.description)) : "",
        email ? `Email: ${email}` : "",
        phone ? `Phone: ${phone}` : "",
        shop.shopAddress?.address1 ? `Address: ${shop.shopAddress.address1}` : "",
        shop.shopAddress?.city ? `City: ${shop.shopAddress.city}` : "",
        shop.shopAddress?.country ? `Country: ${shop.shopAddress.country}` : "",
        currency ? `Currency: ${currency}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      pages.push({
        url: `${siteUrl.replace(/\/$/, "")}/#shop-profile`,
        title: displayName || "Store profile",
        description: "Store profile from Shopify Admin API",
        headings: [displayName || "Store"],
        text,
        emails: email ? [String(email)] : [],
        phones: phone ? [String(phone)] : [],
        links: [siteUrl],
        contentType: "PAGE",
        jsonLd: [],
        imageUrl: undefined,
      });

      for (const policy of shop.shopPolicies ?? []) {
        if (!policy) continue;
        const title = String(policy.title || policy.type || "Policy");
        const body = stripHtml(String(policy.body || ""));
        if (body.length < 20) continue;
        const url = policy.url
          ? String(policy.url)
          : `${siteUrl.replace(/\/$/, "")}/policies/${String(policy.type || title)
              .toLowerCase()
              .replace(/\s+/g, "-")}`;
        pages.push({
          url,
          title,
          description: body.slice(0, 240),
          headings: [title],
          text: [title, body].join("\n\n"),
          emails: [],
          phones: [],
          links: [],
          contentType: classifyPage(url, title, body),
          jsonLd: [],
          imageUrl: undefined,
        });
      }

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
        detail: errorDetail(error),
      });
      warnings.push(
        "Shopify shop profile could not be read via Admin API. Reconnect the app if scopes changed, then scan again.",
      );
    }
  }

  if (input.scope.includeCms) {
    try {
      const limit = Math.min(100, Math.max(1, input.scope.maxPages));
      const payload = await shopifyGraphql<{
        pages?: { edges?: Array<{ node?: { title?: string; handle?: string; body?: string; isPublished?: boolean } | null }> };
      }>(
        creds.shop,
        creds.accessToken,
        `#graphql
        query ShopifyPages($first: Int!) {
          pages(first: $first) {
            edges {
              node {
                title
                handle
                body
                isPublished
              }
            }
          }
        }`,
        { first: limit },
      );
      let pageCount = 0;
      for (const edge of payload.pages?.edges ?? []) {
        const page = edge.node;
        if (!page) continue;
        const title = String(page.title || "Page");
        const handle = String(page.handle || "");
        const body = stripHtml(String(page.body || ""));
        const url = `${(siteUrl || `https://${creds.shop}`).replace(/\/$/, "")}/pages/${handle}`;
        const text = [title, body].filter(Boolean).join("\n\n");
        if (text.length < 12) continue;
        pages.push({
          url,
          title,
          description: body.slice(0, 240),
          headings: [title],
          text,
          emails: [],
          phones: [],
          links: [],
          contentType: classifyPage(url, title, text),
          jsonLd: [],
          imageUrl: undefined,
        });
        pageCount += 1;
      }
      stages.push({
        key: "shopify-pages",
        label: "Read Shopify pages",
        status: pageCount ? "done" : "skipped",
        detail: pageCount ? `${pageCount} Online Store pages` : "No Online Store pages",
      });
    } catch (error) {
      stages.push({
        key: "shopify-pages",
        label: "Read Shopify pages",
        status: "failed",
        detail: errorDetail(error),
      });
      warnings.push(
        "Shopify pages could not be read. Confirm the app has the read_content scope, then reconnect and scan again.",
      );
    }

    try {
      const articleLimit = Math.min(50, Math.max(1, input.scope.maxCmsItemsPerCollection));
      const payload = await shopifyGraphql<{
        articles?: {
          edges?: Array<{
            node?: {
              title?: string;
              handle?: string;
              body?: string;
              summary?: string | null;
              image?: GqlImage | null;
              blog?: { handle?: string; title?: string } | null;
            } | null;
          }>;
        };
      }>(
        creds.shop,
        creds.accessToken,
        `#graphql
        query ShopifyArticles($first: Int!) {
          articles(first: $first) {
            edges {
              node {
                title
                handle
                body
                summary
                image { url altText }
                blog { handle title }
              }
            }
          }
        }`,
        { first: articleLimit },
      );
      let articleCount = 0;
      for (const edge of payload.articles?.edges ?? []) {
        const article = edge.node;
        if (!article) continue;
        const title = String(article.title || "Article");
        const handle = String(article.handle || "");
        const blogHandle = String(article.blog?.handle || "news");
        const body = stripHtml(String(article.body || article.summary || ""));
        const url = `${(siteUrl || `https://${creds.shop}`).replace(/\/$/, "")}/blogs/${blogHandle}/${handle}`;
        const text = [title, body].filter(Boolean).join("\n\n");
        if (text.length < 20) continue;
        pages.push({
          url,
          title,
          description: stripHtml(String(article.summary || body)).slice(0, 240),
          headings: [title],
          text,
          emails: [],
          phones: [],
          links: [],
          contentType: classifyPage(url, title, text),
          jsonLd: [],
          imageUrl: article.image?.url,
        });
        articleCount += 1;
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
      type ProductsPayload = {
        products?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          edges?: Array<{ node?: GqlProduct | null }>;
        };
      };
      const pageSize = Math.min(50, Math.max(1, input.scope.maxProducts));
      let cursor: string | null = null;
      let hasNext = true;

      while (hasNext && products.length < input.scope.maxProducts) {
        const first = Math.min(pageSize, input.scope.maxProducts - products.length);
        const payload: ProductsPayload = await shopifyGraphql<ProductsPayload>(
          creds.shop,
          creds.accessToken,
          `#graphql
          query ShopifyProducts($first: Int!, $after: String) {
            products(first: $first, after: $after) {
              pageInfo { hasNextPage endCursor }
              edges {
                node {
                  id
                  title
                  handle
                  status
                  descriptionHtml
                  vendor
                  productType
                  tags
                  onlineStoreUrl
                  featuredImage { url altText }
                  images(first: 20) {
                    edges { node { url altText } }
                  }
                  priceRangeV2 {
                    minVariantPrice { amount currencyCode }
                    maxVariantPrice { amount currencyCode }
                  }
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        sku
                        price
                        compareAtPrice
                        availableForSale
                        selectedOptions { name value }
                        image { url }
                      }
                    }
                  }
                }
              }
            }
          }`,
          { first, after: cursor },
        );

        const batch = (payload.products?.edges ?? [])
          .map((edge: { node?: GqlProduct | null }) => edge.node)
          .filter(Boolean) as GqlProduct[];
        if (!batch.length) break;

        for (const product of batch) {
          if (products.length >= input.scope.maxProducts) break;
          const title = String(product.title || "Product");
          const handle = String(product.handle || "");
          const base = (siteUrl || `https://${creds.shop}`).replace(/\/$/, "");
          const url = product.onlineStoreUrl || `${base}/products/${handle}`;
          const price = productPriceLabel(product, currency);
          const images = productImageUrls(product);
          const description = productTrainingText({ title, url, product, price, currency });

          products.push({
            id: String(product.id || handle || title),
            name: title,
            description: description.slice(0, 12000),
            price,
            url,
            imageUrl: images[0],
            data: {
              source: "shopify-admin-graphql",
              ...product,
              imageUrl: images[0] || null,
              images: images.map((src) => ({ src, url: src })),
              price,
            } as Prisma.InputJsonValue,
          });
        }

        hasNext = Boolean(payload.products?.pageInfo?.hasNextPage);
        cursor = payload.products?.pageInfo?.endCursor || null;
        if (!hasNext || !cursor) break;
      }

      stages.push({
        key: "shopify-products",
        label: "Read Shopify ecommerce catalog",
        status: products.length ? "done" : "skipped",
        detail: products.length
          ? `${products.length} products (titles, variants, prices, images)`
          : "No products in this store",
      });
    } catch (error) {
      stages.push({
        key: "shopify-products",
        label: "Read Shopify ecommerce catalog",
        status: "failed",
        detail: errorDetail(error),
      });
      warnings.push(
        "Shopify products could not be read. Confirm the app has read_products, then reconnect and scan again.",
      );
    }
  } else {
    skipped.push("Ecommerce catalog reading is included on paid plans.");
  }

  return { pages, products, stages, skipped, warnings, siteUrl, displayName, currency, locale };
}
