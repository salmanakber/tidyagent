import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ShopifyApiError } from "@/modules/shopify/client";
import { shopPublicUrl } from "@/modules/shopify/shop";
import type { ScanScope } from "@/modules/knowledge/scan-scope";
import { classifyPage, type ExtractedPage } from "@/modules/knowledge/extract";
import type { ScanStage } from "@/modules/knowledge/types";
import type { PlatformApiHarvest } from "@/modules/knowledge/webflow-sources";
import {
  getValidShopifyAccessToken,
  isShopifyAuthFailure,
  shopifyGetForSite,
  shopifyGraphqlForSite,
} from "@/modules/shopify/tokens";

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

function shopifyConnectionWarning(error?: unknown) {
  if (isShopifyAuthFailure(error)) {
    return "Your Shopify connection expired. Reopen tidyAgent from Shopify Admin → Apps, wait for the dashboard to load, then scan again.";
  }
  return "Shopify connection missing. Reopen tidyAgent from Shopify Admin → Apps, then scan again.";
}

async function getShopifyCreds(siteId: string) {
  const creds = await getValidShopifyAccessToken(siteId);
  if (!creds) return null;
  const site = await prisma.wixSite.findUnique({ where: { id: siteId } });
  if (!site) return null;
  return { site, siteId, shop: creds.shop, accessToken: creds.accessToken };
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

type ShopProfile = {
  name: string;
  email: string;
  phone: string;
  description: string;
  currencyCode: string | null;
  primaryLocale: string | null;
  myshopifyDomain: string | null;
  primaryDomainUrl: string | null;
  url: string | null;
  address1: string;
  city: string;
  country: string;
};

/**
 * Try rich GraphQL first, then a minimal shop query, then REST /shop.json.
 * Field-level denials must not wipe the whole profile.
 */
async function fetchShopifyShopProfile(siteId: string, shop: string): Promise<ShopProfile> {
  const queries = [
    `query ShopifyShopProfileRich {
      shop {
        name
        contactEmail
        email
        description
        currencyCode
        primaryLocale
        myshopifyDomain
        url
        primaryDomain { url host }
        shopAddress { address1 city country phone }
      }
    }`,
    `query ShopifyShopProfileBasic {
      shop {
        name
        contactEmail
        currencyCode
        primaryLocale
        myshopifyDomain
        url
        primaryDomain { url host }
      }
    }`,
    `query ShopifyShopProfileMinimal {
      shop {
        name
        currencyCode
        myshopifyDomain
        primaryDomain { url host }
      }
    }`,
  ];

  let lastError: unknown = null;
  for (const query of queries) {
    try {
      const data = await shopifyGraphqlForSite<{
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
        };
      }>(siteId, query);
      const row = data.shop;
      if (!row?.name && !row?.myshopifyDomain) {
        lastError = new ShopifyApiError("Shopify returned an empty shop profile");
        continue;
      }
      return {
        name: String(row.name || shop),
        email: String(row.contactEmail || row.email || ""),
        phone: String(row.shopAddress?.phone || ""),
        description: row.description ? stripHtml(String(row.description)) : "",
        currencyCode: row.currencyCode ? String(row.currencyCode) : null,
        primaryLocale: row.primaryLocale ? String(row.primaryLocale) : null,
        myshopifyDomain: row.myshopifyDomain ? String(row.myshopifyDomain) : null,
        primaryDomainUrl: row.primaryDomain?.url || row.primaryDomain?.host || null,
        url: row.url ? String(row.url) : null,
        address1: String(row.shopAddress?.address1 || ""),
        city: String(row.shopAddress?.city || ""),
        country: String(row.shopAddress?.country || ""),
      };
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const payload = await shopifyGetForSite<{
      shop?: {
        name?: string;
        email?: string;
        phone?: string;
        domain?: string;
        myshopify_domain?: string;
        primary_locale?: string;
        currency?: string;
        address1?: string;
        city?: string;
        country?: string;
        description?: string;
      };
    }>(siteId, "/shop.json");
    const row = payload.shop;
    if (row) {
      return {
        name: String(row.name || shop),
        email: String(row.email || ""),
        phone: String(row.phone || ""),
        description: row.description ? stripHtml(String(row.description)) : "",
        currencyCode: row.currency ? String(row.currency) : null,
        primaryLocale: row.primary_locale ? String(row.primary_locale) : null,
        myshopifyDomain: row.myshopify_domain ? String(row.myshopify_domain) : null,
        primaryDomainUrl: row.domain ? String(row.domain) : null,
        url: null,
        address1: String(row.address1 || ""),
        city: String(row.city || ""),
        country: String(row.country || ""),
      };
    }
  } catch (error) {
    lastError = error;
  }

  throw lastError instanceof Error
    ? lastError
    : new ShopifyApiError("Could not read Shopify store profile");
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
    warnings.push(shopifyConnectionWarning());
    return { pages, products, stages, skipped, warnings };
  }

  if (input.scope.includeSiteProperties) {
    // Progressive queries: a single field ACCESS_DENIED must not fail the whole profile.
    try {
      const shop = await fetchShopifyShopProfile(input.siteId, creds.shop);
      displayName = String(shop.name || creds.shop);
      currency = shop.currencyCode;
      locale = shop.primaryLocale;
      siteUrl = shopPublicUrl(creds.shop, shop.myshopifyDomain, shop.primaryDomainUrl || shop.url);
      const email = shop.email || "";
      const phone = shop.phone || "";
      const text = [
        displayName,
        siteUrl,
        shop.description || "",
        email ? `Email: ${email}` : "",
        phone ? `Phone: ${phone}` : "",
        shop.address1 ? `Address: ${shop.address1}` : "",
        shop.city ? `City: ${shop.city}` : "",
        shop.country ? `Country: ${shop.country}` : "",
        currency ? `Currency: ${currency}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      pages.push({
        url: `${siteUrl.replace(/\/$/, "")}/#shop-profile`,
        title: displayName || "Store profile",
        description: "Store profile from Shopify",
        headings: [displayName || "Store"],
        text,
        emails: email ? [email] : [],
        phones: phone ? [phone] : [],
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
      console.error("Shopify store profile harvest failed", {
        shop: creds.shop,
        detail: errorDetail(error),
      });
      stages.push({
        key: "shopify-shop",
        label: "Read Shopify store profile",
        status: "failed",
        detail: errorDetail(error),
      });
      warnings.push(
        isShopifyAuthFailure(error)
          ? shopifyConnectionWarning(error)
          : `We could not read the store profile (${errorDetail(error)}). Reopen tidyAgent from Shopify Admin, then scan again.`,
      );
    }

    try {
      const policyData = await shopifyGraphqlForSite<{
        shop?: {
          shopPolicies?: Array<{
            type?: string | null;
            title?: string | null;
            body?: string | null;
            url?: string | null;
          } | null>;
        };
      }>(
        input.siteId,
        `query ShopifyShopPolicies {
          shop {
            shopPolicies { type title body url }
          }
        }`,
      );
      let policyCount = 0;
      for (const policy of policyData.shop?.shopPolicies ?? []) {
        if (!policy) continue;
        const title = String(policy.title || policy.type || "Policy");
        const body = stripHtml(String(policy.body || ""));
        if (body.length < 20) continue;
        const url = policy.url
          ? String(policy.url)
          : `${(siteUrl || `https://${creds.shop}`).replace(/\/$/, "")}/policies/${String(policy.type || title)
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
        policyCount += 1;
      }
      stages.push({
        key: "shopify-policies",
        label: "Read Shopify store policies",
        status: "done",
        detail: policyCount ? `${policyCount} policies` : "No published policies",
      });
    } catch (error) {
      stages.push({
        key: "shopify-policies",
        label: "Read Shopify store policies",
        status: "skipped",
        detail: errorDetail(error),
      });
      skipped.push(
        "Store policies need the read_legal_policies permission. Update the app scopes in Partner Dashboard, reopen tidyAgent from Apps to approve, then scan again.",
      );
    }
  }

  if (input.scope.includeCms) {
    try {
      const limit = Math.min(100, Math.max(1, input.scope.maxPages));
      const payload = await shopifyGraphqlForSite<{
        pages?: { edges?: Array<{ node?: { title?: string; handle?: string; body?: string; isPublished?: boolean } | null }> };
      }>(
        input.siteId,
        `query ShopifyPages($first: Int!) {
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
        isShopifyAuthFailure(error)
          ? shopifyConnectionWarning(error)
          : "We could not read store pages. Reopen tidyAgent from Shopify Admin, then scan again.",
      );
    }

    try {
      const articleLimit = Math.min(50, Math.max(1, input.scope.maxCmsItemsPerCollection));
      const payload = await shopifyGraphqlForSite<{
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
        input.siteId,
        `query ShopifyArticles($first: Int!) {
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
        const payload: ProductsPayload = await shopifyGraphqlForSite<ProductsPayload>(
          input.siteId,
          `query ShopifyProducts($first: Int!, $after: String) {
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
        isShopifyAuthFailure(error)
          ? shopifyConnectionWarning(error)
          : "We could not read products. Reopen tidyAgent from Shopify Admin, then scan again.",
      );
    }
  } else {
    skipped.push("Ecommerce products are included on paid plans.");
  }

  return { pages, products, stages, skipped, warnings, siteUrl, displayName, currency, locale };
}
