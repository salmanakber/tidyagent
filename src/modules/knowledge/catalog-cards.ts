import { prisma } from "@/lib/prisma";
import { productImageFromRecord } from "@/modules/knowledge/media";
import { expandTerms, questionTerms, textMatchesTerms } from "@/modules/knowledge/match";

export type CatalogCard = {
  name: string;
  price?: string | null;
  imageUrl?: string | null;
  url?: string | null;
};

const PRODUCTISH =
  /\b(product|products|item|items|buy|purchase|shop|store|catalog|menu|package|packages|plan|plans|service|services|rental|rentals|offer|offers|price|prices|how much|show me|looking for|do you (have|sell|offer)|what do you (have|sell|offer))\b/i;

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
  const name = String(meta?.name || stripPriceSuffix(input.title) || "").trim();
  if (!name) return null;
  const price = asOptionalString(meta?.price) || priceFromText(input.cleanedContent || input.title);
  const imageUrl = asOptionalString(meta?.imageUrl) || productImageFromRecord(meta?.data ?? meta);
  const url = asOptionalString(meta?.url) || input.sourceUrl || null;
  if (!imageUrl && !price) return { name, url };
  return { name, price, imageUrl, url };
}

export function matchCatalogCards(question: string, cards: CatalogCard[], limit = 4): CatalogCard[] {
  if (!cards.length) return [];
  const terms = expandTerms(questionTerms(question)).filter(
    (term) => !["price", "prices", "pricing", "cost", "list", "show", "have", "what", "people"].includes(term),
  );
  const scored = cards
    .map((card) => ({ card, score: cardScore(question, terms, card) }))
    .sort((a, b) => b.score - a.score);
  const matched = scored.filter((row) => terms.some((term) => textMatchesTerms(row.card.name, [term]) || textMatchesTerms(row.card.name, terms)));
  if (matched.length) return uniqueCards(matched.map((row) => row.card)).slice(0, limit);
  if (/what do you (have|sell|offer)|show me (your )?(products|menu|packages)|catalog|all products/i.test(question)) {
    return uniqueCards(cards).slice(0, limit);
  }
  return scored.filter((row) => row.score >= 4).map((row) => row.card).slice(0, limit);
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
        contentType: { in: input.includeStores ? ["PRODUCT", "SERVICE"] : ["SERVICE", "PRODUCT"] },
      },
      select: { title: true, sourceUrl: true, metadata: true, cleanedContent: true, contentType: true },
      take: 120,
    }),
    input.includeStores
      ? prisma.product.findMany({
          where: { organizationId: input.organizationId, siteId: input.siteId },
          select: { name: true, data: true },
          take: 120,
        })
      : Promise.resolve([]),
  ]);

  const fromDocs = documents
    .map((row) => cardFromMetadata(row))
    .filter((row): row is CatalogCard => Boolean(row));
  const fromStore = products.map((row) => {
    const data = asRecord(row.data) ?? {};
    const price =
      asOptionalString(asRecord(data.priceData)?.formatted && asRecord(asRecord(data.priceData)?.formatted)?.price) ||
      asOptionalString(asRecord(data.price)?.formatted && asRecord(asRecord(data.price)?.formatted)?.price);
    const pageUrl = asRecord(data.productPageUrl);
    const url =
      asOptionalString(data.url) ||
      [asOptionalString(pageUrl?.base), asOptionalString(pageUrl?.path)].filter(Boolean).join("") ||
      null;
    return {
      name: row.name,
      price,
      imageUrl: productImageFromRecord(data),
      url,
    } satisfies CatalogCard;
  });

  return matchCatalogCards(input.question, [...fromStore, ...fromDocs]);
}

function cardScore(question: string, terms: string[], card: CatalogCard) {
  let score = 0;
  if (textMatchesTerms(`${card.name} ${card.price ?? ""}`, terms)) score += 8;
  if (card.imageUrl) score += 1;
  if (card.price) score += 1;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}
