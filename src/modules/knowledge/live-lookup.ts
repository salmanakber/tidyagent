import { extractPage, isSafeHttpUrl, sameSite } from "@/modules/knowledge/extract";
import { expandTerms, questionTerms, textMatchesTerms } from "@/modules/knowledge/match";
import { prisma } from "@/lib/prisma";
import { isShopifyPlatform, isWebflowPlatform } from "@/modules/platforms/types";

const FETCH_MS = 4500;

/**
 * Runtime site exploration: when stored knowledge is thin, fetch live pages from the
 * connected site (same-origin only) and feed them into the reply evidence set.
 * This is RAG + live crawl — not a fine-tuned model per merchant.
 */
export async function liveLookupForQuestion(input: {
  organizationId: string;
  siteId: string;
  siteUrl?: string | null;
  question: string;
  platform?: string | null;
}) {
  const origin = siteOrigin(input.siteUrl);
  if (!origin) return [];

  const host = new URL(origin).hostname;
  const terms = expandTerms(questionTerms(input.question)).filter(
    (term) => !["price", "prices", "pricing", "cost", "people", "book"].includes(term),
  );

  const documents = await prisma.knowledgeDocument.findMany({
    where: { organizationId: input.organizationId, siteId: input.siteId, sourceUrl: { not: null } },
    select: { title: true, sourceUrl: true, contentType: true },
    take: 240,
  });

  const known = documents
    .filter((row) => row.sourceUrl && textMatchesTerms(`${row.title} ${row.sourceUrl}`, terms))
    .map((row) => row.sourceUrl as string);

  // Prefer product/page URLs already indexed from Shopify/Webflow APIs.
  const catalogish = documents
    .filter((row) => {
      const url = row.sourceUrl || "";
      const type = String(row.contentType || "");
      return (
        type === "PRODUCT" ||
        type === "PAGE" ||
        type === "POLICY" ||
        /\/(products?|pages|policies|collections)\//i.test(url)
      );
    })
    .filter((row) => row.sourceUrl && textMatchesTerms(`${row.title} ${row.sourceUrl}`, terms))
    .map((row) => row.sourceUrl as string);

  const guessed = guessUrls(origin, terms, input.platform);
  const urls = unique([...catalogish, ...known, ...guessed])
    .filter((url) => isSafeHttpUrl(url) && sameSite(url, host))
    .slice(0, 6);

  const pages = await Promise.all(urls.map((url) => fetchPage(url, host)));
  return pages.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

async function fetchPage(url: string, host: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; tidyAgent-LiveLookup/1.0; +https://agent.tidyflowapp.com)",
      },
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const finalUrl = response.url || url;
    if (!isSafeHttpUrl(finalUrl) || !sameSite(finalUrl, host)) return null;
    const html = await response.text();
    if (html.length < 80 || html.length > 1_500_000) return null;
    const page = extractPage(html, finalUrl, 8000);
    return {
      content: page.text.slice(0, 3500),
      title: page.title,
      sourceUrl: page.url,
      contentType: page.contentType,
    };
  } catch {
    return null;
  }
}

function guessUrls(origin: string, terms: string[], platform?: string | null) {
  const base = origin.replace(/\/$/, "");
  const slugs = terms
    .filter((term) => term.length >= 3 && !["the", "and"].includes(term))
    .slice(0, 6)
    .flatMap((term) => {
      const slug = term.replace(/\s+/g, "-");
      if (isShopifyPlatform(platform)) {
        return [`/products/${slug}`, `/pages/${slug}`, `/collections/${slug}`, `/policies/${slug}`];
      }
      if (isWebflowPlatform(platform)) {
        return [`/${slug}`, `/${slug}s`, `/blog/${slug}`];
      }
      return [`/${slug}`, `/${slug}s`, `/product-page/${slug}`];
    });

  const common = isShopifyPlatform(platform)
    ? ["/pages/contact", "/pages/about", "/policies/shipping-policy", "/policies/refund-policy", "/collections/all"]
    : isWebflowPlatform(platform)
      ? ["/pricing", "/contact", "/about", "/services", "/faq"]
      : ["/pricing", "/prices", "/rates", "/rentals", "/packages", "/book", "/booking", "/services"];

  return [...common, ...slugs].map((path) => `${base}${path}`);
}

function siteOrigin(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function unique(values: string[]) {
  return [...new Set(values)];
}
