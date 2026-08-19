import type { KnowledgeContentType, Prisma } from "@prisma/client";
import { createWixAppClient } from "@/services/wix/client";
import { cmsCollectionAllowed, type ScanScope } from "@/modules/knowledge/scan-scope";
import { classifyPage, type ExtractedPage } from "@/modules/knowledge/extract";
import type { ScanStage } from "@/modules/knowledge/types";

export type WixApiHarvest = {
  pages: ExtractedPage[];
  products: {
    name: string;
    description?: string;
    price?: string;
    id?: string;
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
        status: "done",
        detail: cmsPages.length ? `${cmsPages.length} CMS records in ${input.scope.planLabel} scope` : "No readable CMS collections",
      });
    } catch (error) {
      stages.push({
        key: "wix-cms",
        label: "Read Wix CMS collections",
        status: "failed",
        detail: error instanceof Error ? error.message : "CMS unavailable",
      });
      warnings.push("CMS data needs the Wix Data permission. Pages from the live domain were still read.");
    }
  } else {
    skipped.push("CMS reading is included on paid plans.");
  }

  if (input.scope.includeStores) {
    try {
      const catalog = await readStores(client, input.scope);
      products.push(...catalog.products);
      pages.push(...catalog.collections);
      stages.push({
        key: "wix-stores",
        label: "Read Wix Stores catalog",
        status: "done",
        detail: `${catalog.products.length} products · ${catalog.collections.length} collections`,
      });
    } catch (error) {
      stages.push({
        key: "wix-stores",
        label: "Read Wix Stores catalog",
        status: "failed",
        detail: error instanceof Error ? error.message : "Stores API unavailable",
      });
      warnings.push("Stores catalog could not be read. Page and CMS content was still indexed.");
    }
  } else {
    skipped.push("Wix Stores catalog is included on Business and Pro.");
    stages.push({
      key: "wix-stores",
      label: "Wix Stores catalog",
      status: "skipped",
      detail: `${input.scope.planLabel} does not include live inventory tools`,
    });
  }

  return { pages, products, stages, skipped, warnings };
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
  const listed = await client.cmsCollections.listDataCollections({
    paging: { limit: Math.max(scope.maxCmsCollections * 2, 20) },
  });
  const collections = ((listed as { collections?: { _id?: string; displayName?: string }[] }).collections ?? [])
    .map((row) => ({ id: String(row._id || ""), name: String(row.displayName || row._id || "Collection") }))
    .filter((row) => row.id && cmsCollectionAllowed(row.id, scope))
    .slice(0, scope.maxCmsCollections);

  const pages: ExtractedPage[] = [];
  for (const collection of collections) {
    const items = await queryCollectionItems(client, collection.id, scope.maxCmsItemsPerCollection);
    for (const item of items) {
      const title = String(item.title || item.name || item.headline || `${collection.name} item`);
      const text = flattenValue(item);
      if (text.length < 24) continue;
      const url = typeof item.url === "string" && item.url.startsWith("http") ? item.url : `${siteUrl.replace(/\/$/, "")}/cms/${encodeURIComponent(collection.id)}`;
      pages.push(toPage(`${collection.name}: ${title}`.slice(0, 180), url, text, classifyPage(url, title, text)));
    }
  }
  return pages;
}

async function queryCollectionItems(
  client: ReturnType<typeof createWixAppClient>,
  collectionId: string,
  limit: number,
) {
  const query = client.cmsItems.query as unknown as (
    id: string,
  ) => { limit?: (n: number) => { find: () => Promise<{ items?: Record<string, unknown>[] }> }; find?: () => Promise<{ items?: Record<string, unknown>[] }> };
  const builder = query(collectionId);
  const result =
    builder && typeof builder.limit === "function"
      ? await builder.limit(limit).find()
      : builder && typeof builder.find === "function"
        ? await builder.find()
        : { items: [] };
  return (result.items ?? []).slice(0, limit);
}

async function readStores(client: ReturnType<typeof createWixAppClient>, scope: ScanScope) {
  const productResult = await client.products.queryProducts().limit(scope.maxProducts).find();
  const productItems = itemsOf(productResult);
  const products = productItems.map((product) => {
    const priceData = product.priceData as { formatted?: { price?: string }; price?: number } | undefined;
    const price = product.price as { formatted?: { price?: string } } | undefined;
    return {
      id: String(product._id ?? product.id ?? ""),
      name: String(product.name || "Product"),
      description: product.description ? stripTags(String(product.description)).slice(0, 1500) : undefined,
      price:
        priceData?.formatted?.price ||
        price?.formatted?.price ||
        (priceData?.price != null ? String(priceData.price) : undefined),
      data: product as Prisma.InputJsonValue,
    };
  });

  let collections: ExtractedPage[] = [];
  try {
    const catalogResult = await client.storeCatalogs.queryCollections().limit(40).find();
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
  };
}

function itemsOf(result: unknown) {
  const row = result as { items?: Record<string, unknown>[]; products?: Record<string, unknown>[]; collections?: Record<string, unknown>[] };
  return row.items ?? row.products ?? row.collections ?? [];
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
