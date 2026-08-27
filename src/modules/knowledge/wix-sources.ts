import type { KnowledgeContentType, Prisma } from "@prisma/client";
import { createWixAppClient } from "@/services/wix/client";
import { cmsCollectionAllowed, type ScanScope } from "@/modules/knowledge/scan-scope";
import { classifyPage, type ExtractedPage } from "@/modules/knowledge/extract";
import type { ScanStage } from "@/modules/knowledge/types";
import { productImageFromRecord } from "@/modules/knowledge/media";

export type WixApiHarvest = {
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
};

export async function harvestWixApis(input: {
  wixInstanceId: string;
  siteUrl: string;
  scope: ScanScope;
}): Promise<WixApiHarvest> {
  const pages: ExtractedPage[] = [];
  const products: WixApiHarvest["products"] = [];
  const stages: ScanStage[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  if (!input.scope.includeSiteProperties && !input.scope.includeCms && !input.scope.includeStores) {
    skipped.push(`${input.scope.planLabel} does not include Wix API reading.`);
    return { pages, products, stages, skipped, warnings };
  }

  let client: ReturnType<typeof createWixAppClient>;
  try {
    client = createWixAppClient(input.wixInstanceId);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Wix API client unavailable");
    return { pages, products, stages, skipped, warnings };
  }

  if (input.scope.includeSiteProperties) {
    try {
      const page = await readSiteProperties(client, input.siteUrl);
      if (page) pages.push(page);
      stages.push({
        key: "wix-site",
        label: "Read Wix site profile",
        status: "done",
        detail: page?.title || "Site properties",
      });
    } catch (error) {
      stages.push({
        key: "wix-site",
        label: "Read Wix site profile",
        status: "failed",
        detail: error instanceof Error ? error.message : "Site properties unavailable",
      });
      warnings.push("Wix site properties could not be read. Domain crawl still runs in plan scope.");
    }
  }

  if (input.scope.includeCms) {
    try {
      const cmsPages = await readCmsCollections(client, input.siteUrl, input.scope);
      pages.push(...cmsPages);
      stages.push({
        key: "wix-cms",
        label: "Read Wix CMS collections",
        status: cmsPages.length ? "done" : "skipped",
        detail: cmsPages.length
          ? `${cmsPages.length} CMS records in ${input.scope.planLabel} scope`
          : "No CMS collections listed on this site",
      });
    } catch (error) {
      if (looksLikePermissionError(error)) {
        stages.push({
          key: "wix-cms",
          label: "Read Wix CMS collections",
          status: "failed",
          detail: error instanceof Error ? error.message : "CMS unavailable",
        });
        warnings.push(cmsWarning(error));
      } else {
        stages.push({
          key: "wix-cms",
          label: "Read Wix CMS collections",
          status: "skipped",
          detail: "CMS collections were not listed; live pages were still indexed",
        });
      }
    }
  } else {
    skipped.push("CMS reading is included on paid plans.");
  }

  if (input.scope.includeStores) {
    try {
      const catalog = await readStores(client, input.siteUrl, input.scope);
      products.push(...catalog.products);
      pages.push(...catalog.collections);
      stages.push({
        key: "wix-stores",
        label: "Read Wix Stores catalog",
        status: catalog.products.length ? "done" : "skipped",
        detail: `${catalog.products.length} products · ${catalog.collections.length} collections`,
      });
    } catch (error) {
      stages.push({
        key: "wix-stores",
        label: "Read Wix Stores catalog",
        status: "failed",
        detail: error instanceof Error ? error.message : "Stores API unavailable",
      });
      warnings.push(storesWarning(error));
    }
  } else {
    skipped.push("Ecommerce catalog reading is included on paid plans.");
    stages.push({
      key: "wix-stores",
      label: "Wix Stores catalog",
      status: "skipped",
      detail: `${input.scope.planLabel} does not include live inventory tools`,
    });
  }

  return { pages, products, stages, skipped, warnings };
}

function looksLikePermissionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /permission|forbidden|not authorized|403|ACCESS_DENIED|insufficient/i.test(message);
}

function cmsWarning(error: unknown) {
  if (looksLikePermissionError(error)) {
    return "CMS data needs the Wix Data permission (Permissions → Wix Data: Read collections and items). Pages from the live domain were still read.";
  }
  const message = error instanceof Error ? error.message.slice(0, 140) : "CMS unavailable";
  return `CMS collections could not be read (${message}). Pages from the live domain were still indexed.`;
}

function storesWarning(error: unknown) {
  if (looksLikePermissionError(error)) {
    return "Stores catalog needs the Read Stores permission. Page and CMS content was still indexed.";
  }
  const message = error instanceof Error ? error.message.slice(0, 140) : "Stores unavailable";
  return `Stores catalog could not be read (${message}). Page and CMS content was still indexed.`;
}

async function readSiteProperties(client: ReturnType<typeof createWixAppClient>, siteUrl: string) {
  const response = await client.siteProperties.getSiteProperties();
  const props = (response as { properties?: Record<string, unknown> }).properties ?? {};
  const text = flattenValue(props).slice(0, 8000);
  if (text.length < 20) return null;
  const title = String(props.businessName || props.siteDisplayName || "Wix site profile");
  return toPage(title, siteUrl, text, "PAGE");
}

async function readCmsCollections(
  client: ReturnType<typeof createWixAppClient>,
  siteUrl: string,
  scope: ScanScope,
) {
  const listed = await listCollections(client, scope);
  const collections = listed
    .map((row) => ({ id: String(row.id || ""), name: String(row.name || row.id || "Collection") }))
    .filter((row) => row.id && cmsCollectionAllowed(row.id, scope))
    .slice(0, scope.maxCmsCollections);

  const pages: ExtractedPage[] = [];
  for (const collection of collections) {
    try {
      const items = await queryCollectionItems(client, collection.id, scope.maxCmsItemsPerCollection);
      for (const item of items) {
        const title = String(item.title || item.name || item.headline || `${collection.name} item`);
        const text = flattenValue(item);
        if (text.length < 24) continue;
        const url =
          (typeof item.url === "string" && item.url.startsWith("http") && item.url) ||
          (typeof item.link === "string" && item.link.startsWith("http") && item.link) ||
          `${siteUrl.replace(/\/$/, "")}/cms/${encodeURIComponent(collection.id)}`;
        pages.push(toPage(`${collection.name}: ${title}`.slice(0, 180), url, text, classifyPage(url, title, text)));
      }
    } catch {
      /* skip one collection, keep the rest */
    }
  }
  return pages;
}

async function listCollections(client: ReturnType<typeof createWixAppClient>, scope: ScanScope) {
  const limit = Math.min(100, Math.max(scope.maxCmsCollections * 2, 20));
  const attempts: Array<() => Promise<{ id: string; name: string }[]>> = [
    async () => mapCollections(await client.cmsCollections.listDataCollections({ paging: { limit } })),
    async () => mapCollections(await client.cmsCollections.listDataCollections({})),
    async () => {
      const query = (client.cmsCollections as unknown as { queryDataCollections?: (input?: unknown) => Promise<unknown> }).queryDataCollections;
      if (!query) return [];
      return mapCollections(await query({ paging: { limit } }));
    },
  ];
  let permissionError: unknown = null;
  let listedOk = false;
  for (const attempt of attempts) {
    try {
      const rows = await attempt();
      listedOk = true;
      if (rows.length) return rows;
    } catch (error) {
      if (looksLikePermissionError(error)) permissionError = error;
    }
  }
  if (permissionError && !listedOk) throw permissionError;
  return [];
}

function mapCollections(listed: unknown) {
  const collections =
    (listed as { collections?: { _id?: string; id?: string; displayName?: string; name?: string }[] }).collections ?? [];
  return collections.map((row) => ({
    id: String(row._id || row.id || ""),
    name: String(row.displayName || row.name || row._id || "Collection"),
  }));
}

async function queryCollectionItems(
  client: ReturnType<typeof createWixAppClient>,
  collectionId: string,
  limit: number,
) {
  const api = client.cmsItems as unknown as {
    query?: (id: string) => {
      limit?: (n: number) => { find: () => Promise<{ items?: Record<string, unknown>[] }> };
      find?: () => Promise<{ items?: Record<string, unknown>[] }>;
    };
    queryDataItems?: (input: { dataCollectionId: string; paging?: { limit: number; offset?: number } }) => Promise<{
      dataItems?: { data?: Record<string, unknown> }[];
      items?: Record<string, unknown>[];
    }>;
  };

  if (typeof api.query === "function") {
    try {
      const builder = api.query(collectionId);
      const result =
        builder && typeof builder.limit === "function"
          ? await builder.limit(limit).find()
          : builder && typeof builder.find === "function"
            ? await builder.find()
            : { items: [] };
      const items = result.items ?? [];
      if (items.length) return items.slice(0, limit);
    } catch {
      /* try queryDataItems */
    }
  }

  if (typeof api.queryDataItems === "function") {
    const pageSize = Math.min(100, Math.max(limit, 1));
    const items: Record<string, unknown>[] = [];
    let offset = 0;
    while (items.length < limit) {
      const take = Math.min(pageSize, limit - items.length);
      const result = await api.queryDataItems({
        dataCollectionId: collectionId,
        paging: { limit: take, offset },
      });
      const fromData = (result.dataItems ?? []).map((row) => row.data ?? {}).filter((row) => Object.keys(row).length);
      const batch = fromData.length ? fromData : (result.items ?? []);
      items.push(...batch);
      if (batch.length < take) break;
      offset += batch.length;
    }
    return items.slice(0, limit);
  }

  return [];
}

async function readStores(client: ReturnType<typeof createWixAppClient>, siteUrl: string, scope: ScanScope) {
  const productItems = await queryStoreProducts(client, scope.maxProducts);
  const products = productItems.map((product) => {
    const priceData = product.priceData as { formatted?: { price?: string; discountPrice?: string }; price?: number; currency?: string } | undefined;
    const price = product.price as { formatted?: { price?: string } } | undefined;
    const pageUrl = product.productPageUrl as { base?: string; path?: string; url?: string } | undefined;
    const url =
      (typeof product.url === "string" && product.url) ||
      pageUrl?.url ||
      [pageUrl?.base, pageUrl?.path].filter(Boolean).join("") ||
      (typeof product.slug === "string" ? `${siteUrl.replace(/\/$/, "")}/product-page/${product.slug}` : undefined);
    const formatted =
      priceData?.formatted?.discountPrice ||
      priceData?.formatted?.price ||
      price?.formatted?.price ||
      (priceData?.price != null ? `${priceData.currency ? `${priceData.currency} ` : ""}${priceData.price}` : undefined);
    return {
      id: String(product._id ?? product.id ?? ""),
      name: String(product.name || "Product"),
      description: product.description ? stripTags(String(product.description)).slice(0, 1500) : undefined,
      price: formatted,
      url,
      imageUrl: productImageFromRecord(product) || undefined,
      data: product as Prisma.InputJsonValue,
    };
  });

  let collections: ExtractedPage[] = [];
  try {
    const catalogResult = await client.storeCatalogs.queryCollections().limit(100).find();
    collections = itemsOf(catalogResult).map((row) => {
      const name = String(row.name || "Collection");
      const text = flattenValue(row);
      return toPage(`Store collection: ${name}`, String(row.slug || name), text, "PRODUCT");
    });
  } catch {
    collections = [];
  }

  return { products, collections };
}

function toPage(title: string, url: string, text: string, contentType: KnowledgeContentType): ExtractedPage {
  return {
    url,
    title,
    description: text.slice(0, 320),
    headings: [title],
    text,
    emails: [],
    phones: [],
    links: [],
    contentType,
    jsonLd: [],
  };
}

function itemsOf(result: unknown) {
  const row = result as { items?: Record<string, unknown>[]; products?: Record<string, unknown>[]; collections?: Record<string, unknown>[] };
  return row.items ?? row.products ?? row.collections ?? [];
}

type ProductQueryResult = {
  items?: Record<string, unknown>[];
  products?: Record<string, unknown>[];
  hasNext?: () => boolean | Promise<boolean>;
  next?: () => Promise<ProductQueryResult>;
};

async function queryStoreProducts(client: ReturnType<typeof createWixAppClient>, max: number) {
  const pageSize = 100;
  const products: Record<string, unknown>[] = [];
  let skip = 0;
  let page: ProductQueryResult | null = null;

  while (products.length < max) {
    const take = Math.min(pageSize, max - products.length);
    const canPage =
      Boolean(page && typeof page.next === "function") &&
      (typeof page?.hasNext !== "function" || Boolean(await page.hasNext()));
    try {
      if (canPage && page?.next) {
        page = await page.next();
      } else {
        if (page && typeof page.hasNext === "function" && !(await page.hasNext())) break;
        const root = client.products.queryProducts() as unknown as {
          skip?: (n: number) => { limit: (n: number) => { find: () => Promise<ProductQueryResult> } };
          limit: (n: number) => { find: () => Promise<ProductQueryResult> };
        };
        if (skip > 0 && typeof root.skip !== "function") break;
        const skipped = skip > 0 && typeof root.skip === "function" ? root.skip(skip) : root;
        page = await skipped.limit(take).find();
      }
    } catch {
      break;
    }
    const batch = itemsOf(page);
    if (!batch.length) break;
    products.push(...batch);
    skip = products.length;
    if (batch.length < take) break;
  }
  return products.slice(0, max);
}

function flattenValue(value: unknown, depth = 0): string {
  if (value == null || depth > 3) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenValue(item, depth + 1)).filter(Boolean).join(" · ");
  if (typeof value !== "object") return "";
  const skip = new Set([
    "_id",
    "_owner",
    "_createdDate",
    "_updatedDate",
    "createdDate",
    "updatedDate",
    "mainMedia",
    "mediaItems",
    "image",
    "coverImage",
  ]);
  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !skip.has(key) && !key.startsWith("_"))
    .map(([key, item]) => {
      const inner = flattenValue(item, depth + 1);
      return inner ? `${key}: ${inner}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
