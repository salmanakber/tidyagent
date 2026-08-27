import { prisma } from "@/lib/prisma";
import { productImageFromRecord, firstImageUrl } from "@/modules/knowledge/media";
import { expandTerms, questionTerms, textMatchesTerms } from "@/modules/knowledge/match";

export type CatalogCardVariant = {
  title: string;
  price?: string | null;
  available?: boolean | null;
  sku?: string | null;
};

export type CatalogCard = {
  name: string;
  price?: string | null;
  compareAtPrice?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  images?: string[];
  url?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[];
  variants?: CatalogCardVariant[];
  available?: boolean | null;
};

const PRODUCTISH =
  /\b(product|products|item|items|buy|purchase|shop|store|catalog|menu|package|packages|plan|plans|service|services|rental|rentals|offer|offers|price|prices|how much|show me|looking for|recommend|recommendation|do you (have|sell|offer)|what do you (have|sell|offer)|any .+ (left|available)|in stock)\b/i;

export function isCatalogQuestion(text: string) {
  return PRODUCTISH.test(text) || /\$\s*\d/.test(text);
}

export function cardFromMetadata(input: {
  title: string;
  sourceUrl?: string | null;
  metadata?: unknown;
  cleanedContent?: string | null;
}): CatalogCard | null {
  const meta = asRecord(input.metadata);
  const data = asRecord(meta?.data) ?? meta;
  const name = decodeEntities(String(meta?.name || stripPriceSuffix(input.title) || "")).trim();
  if (!name || isPageTitleName(name)) return null;

  const price =
    asOptionalString(meta?.price) ||
    priceFromData(data) ||
    priceFromText(input.cleanedContent || input.title);
  const compareAtPrice = asOptionalString(meta?.compareAtPrice) || compareAtFromData(data);
  const imageUrl =
    asOptionalString(meta?.imageUrl) || productImageFromRecord(data) || productImageFromRecord(meta);
  const images = uniqueUrls([
    imageUrl,
    ...imagesFromData(data),
    ...(Array.isArray(meta?.images) ? meta.images.map((item) => asOptionalString(item)) : []),
  ]);
  const url = asOptionalString(meta?.url) || input.sourceUrl || null;
  const description =
    asOptionalString(meta?.description) ||
    descriptionFromData(data) ||
    descriptionFromContent(input.cleanedContent, name, price);
  const variants = variantsFromData(data);
  const tags = tagsFromData(data);
  const vendor = asOptionalString(meta?.vendor) || asOptionalString(data?.vendor);
  const productType =
    asOptionalString(meta?.productType) ||
    asOptionalString(data?.productType) ||
    asOptionalString(data?.type);
  const available = availabilityFromData(data, variants);

  if (!price && !imageUrl && !description && !url) return null;

  return {
    name,
    price,
    compareAtPrice,
    description: description?.slice(0, 280) || null,
    imageUrl: images[0] || imageUrl,
    images: images.slice(0, 6),
    url,
    vendor,
    productType,
    tags: tags.slice(0, 8),
    variants: variants.slice(0, 12),
    available,
  };
}

export function isPageTitleName(name: string) {
  const value = name.trim();
  if (value.length < 2 || value.length > 72) return true;
  if (/[|]/.test(value)) return true;
  if (/&amp;|&#\w+;/.test(value)) return true;
  if ((value.match(/,/g) || []).length >= 2) return true;
  if (/, [A-Z]{2}\b/.test(value) && /\b(usa|united states|uk|canada|australia)\b/i.test(value)) return true;
  if (/^(home|homepage|welcome|about us|contact|blog|untitled|new site)\b/i.test(value)) return true;
  if (/:\s+.+\s+(&|and)\s+/i.test(value) && value.split(/\s+/).length >= 8) return true;
  return /^(prices and offerings|verified prices|page)$/i.test(value);
}

export function matchCatalogCards(question: string, cards: CatalogCard[], limit = 4): CatalogCard[] {
  const pool = offerCardsForQuestion(question, cards);
  if (!pool.length) return [];
  const terms = expandTerms(questionTerms(question)).filter(
    (term) =>
      !["price", "prices", "pricing", "cost", "list", "show", "have", "what", "people", "recommend", "looking"].includes(
        term,
      ),
  );
  const scored = pool
    .map((card) => ({ card, score: cardScore(question, terms, card) }))
    .sort((a, b) => b.score - a.score);
  const matched = scored.filter((row) =>
    terms.some(
      (term) =>
        textMatchesTerms(cardSearchBlob(row.card), [term]) || textMatchesTerms(cardSearchBlob(row.card), terms),
    ),
  );
  if (matched.length) return uniqueCards(matched.map((row) => row.card)).slice(0, limit);
  if (
    /what do you (have|sell|offer)|show me (your )?(products|menu|packages)|catalog|all products|recommend/i.test(
      question,
    )
  ) {
    return uniqueCards(pool).slice(0, limit);
  }
  if (!terms.length && isPriceListQuestion(question)) return uniqueCards(pool).slice(0, limit);
  return scored.filter((row) => row.score >= 4).map((row) => row.card).slice(0, limit);
}

function offerCardsForQuestion(question: string, cards: CatalogCard[]) {
  const usable = cards.filter((card) => card.name && !isPageTitleName(card.name));
  if (isPriceListQuestion(question)) return usable.filter((card) => Boolean(card.price));
  return usable.filter((card) => Boolean(card.price || card.imageUrl || card.description || card.url));
}

export function isPriceListQuestion(text: string) {
  return /price|pricing|cost|how much|fee|rate|list|quote|plan|plans|package|charge|\$/.test(text.toLowerCase());
}

export async function loadCatalogCards(input: {
  organizationId: string;
  siteId: string;
  question: string;
  includeStores: boolean;
}): Promise<CatalogCard[]> {
  if (!isCatalogQuestion(input.question) && !/\$/.test(input.question)) return [];

  const [documents, products] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        contentType: { in: ["PRODUCT", "SERVICE"] },
      },
      select: { title: true, sourceUrl: true, metadata: true, cleanedContent: true, contentType: true },
      take: 160,
    }),
    input.includeStores
      ? prisma.product.findMany({
          where: { organizationId: input.organizationId, siteId: input.siteId },
          select: { name: true, data: true },
          take: 160,
        })
      : Promise.resolve([]),
  ]);

  const fromDocs = documents
    .map((row) => cardFromMetadata(row))
    .filter((row): row is CatalogCard => Boolean(row));
  const fromStore = products
    .map((row) => cardFromStoreRow(row.name, row.data))
    .filter((row): row is CatalogCard => Boolean(row));

  return matchCatalogCards(input.question, [...fromStore, ...fromDocs]);
}

export function formatCatalogCardsForPrompt(cards: CatalogCard[]) {
  return cards
    .map((card) => {
      const lines = [
        card.name,
        card.price ? `Price: ${card.price}` : null,
        card.compareAtPrice ? `Compare at: ${card.compareAtPrice}` : null,
        card.available === false ? "Availability: out of stock" : card.available ? "Availability: in stock" : null,
        card.vendor ? `Vendor: ${card.vendor}` : null,
        card.productType ? `Type: ${card.productType}` : null,
        card.tags?.length ? `Tags: ${card.tags.join(", ")}` : null,
        card.description ? `Details: ${card.description}` : null,
        card.variants?.length
          ? `Options: ${card.variants
              .slice(0, 8)
              .map((variant) => {
                const bits = [variant.title, variant.price, variant.available === false ? "out of stock" : null]
                  .filter(Boolean)
                  .join(" · ");
                return bits;
              })
              .join("; ")}`
          : null,
        card.url ? `URL: ${card.url}` : null,
      ].filter(Boolean);
      return `- ${lines.join(" | ")}`;
    })
    .join("\n");
}

function cardFromStoreRow(name: string, raw: unknown): CatalogCard | null {
  const data = asRecord(raw) ?? {};
  const decoded = decodeEntities(name).trim();
  if (!decoded || isPageTitleName(decoded)) return null;
  const price = priceFromData(data);
  const compareAtPrice = compareAtFromData(data);
  const images = uniqueUrls([productImageFromRecord(data), ...imagesFromData(data)]);
  const pageUrl = asRecord(data.productPageUrl);
  const url =
    asOptionalString(data.url) ||
    asOptionalString(data.onlineStoreUrl) ||
    [asOptionalString(pageUrl?.base), asOptionalString(pageUrl?.path)].filter(Boolean).join("") ||
    null;
  const description = descriptionFromData(data);
  const variants = variantsFromData(data);
  if (!price && !images[0] && !description && !url) return null;
  return {
    name: decoded,
    price,
    compareAtPrice,
    description: description?.slice(0, 280) || null,
    imageUrl: images[0] || null,
    images: images.slice(0, 6),
    url,
    vendor: asOptionalString(data.vendor),
    productType: asOptionalString(data.productType) || asOptionalString(data.type),
    tags: tagsFromData(data).slice(0, 8),
    variants: variants.slice(0, 12),
    available: availabilityFromData(data, variants),
  };
}

function cardSearchBlob(card: CatalogCard) {
  return [
    card.name,
    card.price,
    card.description,
    card.vendor,
    card.productType,
    ...(card.tags || []),
    ...(card.variants || []).map((variant) => variant.title),
  ]
    .filter(Boolean)
    .join(" ");
}

function cardScore(question: string, terms: string[], card: CatalogCard) {
  let score = 0;
  const blob = cardSearchBlob(card);
  if (textMatchesTerms(blob, terms)) score += 8;
  if (card.imageUrl) score += 2;
  if (card.price) score += 2;
  if (card.description) score += 1;
  if (card.variants?.length) score += 1;
  if (card.available === false && /\b(available|in stock|left)\b/i.test(question)) score -= 3;
  if (!terms.length && isCatalogQuestion(question)) score += 1;
  return score;
}

function uniqueCards(cards: CatalogCard[]) {
  const seen = new Set<string>();
  const out: CatalogCard[] = [];
  for (const card of cards) {
    const key = card.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

function stripPriceSuffix(title: string) {
  return title.replace(/\s+[—–-]\s+\$?\d[\d,.]*.*$/, "").trim();
}

function priceFromText(value: string) {
  const match = value.match(/(?:USD|PKR|GBP|EUR|CAD|AUD|Rs\.?|£|€|\$)\s*[\d,]+(?:\.\d{1,2})?/i);
  return match?.[0]?.replace(/\s+/g, " ").trim() || null;
}

function priceFromData(data: Record<string, unknown> | null) {
  if (!data) return null;
  const direct = asOptionalString(data.price);
  if (direct && /[0-9]/.test(direct)) return direct;
  const priceData = asRecord(data.priceData);
  const formatted = asRecord(priceData?.formatted) || asRecord(asRecord(data.price)?.formatted);
  const fromWix =
    asOptionalString(formatted?.discountPrice) ||
    asOptionalString(formatted?.price) ||
    (priceData?.price != null
      ? `${priceData.currency ? `${priceData.currency} ` : ""}${priceData.price}`.trim()
      : null);
  if (fromWix) return fromWix;

  const range = asRecord(data.priceRangeV2) || asRecord(data.priceRange);
  const min = asRecord(range?.minVariantPrice) || asRecord(range?.min);
  if (min?.amount != null) {
    return `${min.currencyCode || min.currency || ""} ${min.amount}`.trim();
  }

  const skus = Array.isArray(data.skus) ? data.skus : [];
  const firstSku = asRecord(skus[0]);
  const skuPrice = asRecord(firstSku?.price);
  if (skuPrice?.value != null || skuPrice?.amount != null) {
    return `${skuPrice.unit || skuPrice.currency || ""} ${skuPrice.value ?? skuPrice.amount}`.trim();
  }

  const variants = variantsFromData(data);
  return variants[0]?.price || null;
}

function compareAtFromData(data: Record<string, unknown> | null) {
  if (!data) return null;
  const variants = asRecord(data.variants);
  const edges = Array.isArray(variants?.edges) ? variants.edges : [];
  for (const edge of edges) {
    const node = asRecord(asRecord(edge)?.node) || asRecord(edge);
    const compare = asOptionalString(node?.compareAtPrice);
    if (compare) return compare;
  }
  if (Array.isArray(data.variants)) {
    for (const row of data.variants) {
      const compare = asOptionalString(asRecord(row)?.compareAtPrice);
      if (compare) return compare;
    }
  }
  return null;
}

function descriptionFromData(data: Record<string, unknown> | null) {
  if (!data) return null;
  const html =
    asOptionalString(data.descriptionHtml) ||
    asOptionalString(data.description) ||
    asOptionalString(data.body_html) ||
    asOptionalString(asRecord(data.fieldData)?.description);
  if (!html) return null;
  return stripTags(html).slice(0, 400) || null;
}

function descriptionFromContent(content: string | null | undefined, name: string, price?: string | null) {
  if (!content) return null;
  let text = stripTags(content);
  text = text.replace(name, " ").replace(price || "", " ");
  text = text.replace(/^Price:\s*[^\n]+/i, " ");
  text = text.replace(/Product URL:\s*\S+/i, " ");
  text = text.replace(/Variants:[\s\S]*?(?=Images:|$)/i, " ");
  text = text.replace(/Images:[\s\S]*$/i, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length < 24) return null;
  return text.slice(0, 280);
}

function imagesFromData(data: Record<string, unknown> | null): string[] {
  if (!data) return [];
  const out: Array<string | null> = [];
  out.push(asOptionalString(asRecord(data.featuredImage)?.url));
  out.push(asOptionalString(asRecord(data.image)?.src) || asOptionalString(asRecord(data.image)?.url));

  const images = data.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      out.push(asOptionalString(asRecord(item)?.src) || asOptionalString(asRecord(item)?.url) || asOptionalString(item));
    }
  } else {
    const edges = asRecord(images)?.edges;
    if (Array.isArray(edges)) {
      for (const edge of edges) {
        out.push(asOptionalString(asRecord(asRecord(edge)?.node)?.url));
      }
    }
  }

  const media = asRecord(data.media);
  if (Array.isArray(media?.items)) {
    for (const item of media.items) {
      out.push(firstImageUrl(asRecord(item)?.image, item));
    }
  }

  const fieldData = asRecord(data.fieldData);
  if (fieldData) {
    out.push(firstImageUrl(fieldData.image, fieldData.mainImage, fieldData.thumbnail, fieldData.photo));
  }

  return uniqueUrls(out);
}

function variantsFromData(data: Record<string, unknown> | null): CatalogCardVariant[] {
  if (!data) return [];
  const out: CatalogCardVariant[] = [];

  const gql = asRecord(data.variants);
  const edges = Array.isArray(gql?.edges) ? gql.edges : [];
  for (const edge of edges) {
    const node = asRecord(asRecord(edge)?.node);
    if (!node) continue;
    const options = Array.isArray(node.selectedOptions)
      ? node.selectedOptions
          .map((opt) => {
            const row = asRecord(opt);
            return row?.value ? String(row.value) : "";
          })
          .filter(Boolean)
          .join(" / ")
      : "";
    const title =
      options ||
      (asOptionalString(node.title) && asOptionalString(node.title) !== "Default Title"
        ? asOptionalString(node.title)
        : "Standard");
    out.push({
      title: title || "Standard",
      price: asOptionalString(node.price),
      available: typeof node.availableForSale === "boolean" ? node.availableForSale : null,
      sku: asOptionalString(node.sku),
    });
  }

  if (Array.isArray(data.variants)) {
    for (const row of data.variants) {
      const node = asRecord(row);
      if (!node) continue;
      const title =
        asOptionalString(node.title) && asOptionalString(node.title) !== "Default Title"
          ? asOptionalString(node.title)
          : asOptionalString(node.option1) || "Standard";
      out.push({
        title: title || "Standard",
        price: asOptionalString(node.price),
        available: typeof node.available === "boolean" ? node.available : null,
        sku: asOptionalString(node.sku),
      });
    }
  }

  if (Array.isArray(data.skus)) {
    for (const row of data.skus) {
      const sku = asRecord(row);
      if (!sku) continue;
      const fieldData = asRecord(sku.fieldData);
      const priceObj = asRecord(sku.price) || asRecord(fieldData?.price);
      const amount = priceObj?.value ?? priceObj?.amount;
      out.push({
        title: asOptionalString(fieldData?.name) || asOptionalString(sku.sku) || "Option",
        price: amount != null ? `${priceObj?.unit || priceObj?.currency || ""} ${amount}`.trim() : null,
        available: null,
        sku: asOptionalString(sku.sku) || asOptionalString(fieldData?.sku),
      });
    }
  }

  return out.filter((row, index, list) => list.findIndex((item) => item.title === row.title && item.price === row.price) === index);
}

function tagsFromData(data: Record<string, unknown> | null) {
  if (!data) return [] as string[];
  if (Array.isArray(data.tags)) return data.tags.map((tag) => String(tag)).filter(Boolean);
  if (typeof data.tags === "string") {
    return data.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function availabilityFromData(data: Record<string, unknown> | null, variants: CatalogCardVariant[]) {
  if (variants.some((variant) => variant.available === true)) return true;
  if (variants.length && variants.every((variant) => variant.available === false)) return false;
  if (typeof data?.availableForSale === "boolean") return data.availableForSale;
  if (typeof data?.inStock === "boolean") return data.inStock;
  return null;
}

function uniqueUrls(values: Array<string | null | undefined>) {
  const out: string[] = [];
  for (const value of values) {
    if (!value || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function decodeEntities(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function asOptionalString(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
