import type { KnowledgeContentType } from "@prisma/client";
import { pathPriority } from "@/modules/knowledge/scan-scope";
import { extractJsonLdNodes, pageFactsBlock } from "@/modules/knowledge/facts";

export type ExtractedPage = {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
  emails: string[];
  phones: string[];
  links: string[];
  contentType: KnowledgeContentType;
  jsonLd: Record<string, unknown>[];
};

const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|\[::1\])/i;

export function normalizeHost(value: string) {
  return value.replace(/^www\./i, "").toLowerCase();
}

export function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (BLOCKED_HOSTS.test(url.hostname) || BLOCKED_HOSTS.test(url.hostname.replace(/^\[|\]$/g, ""))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function sameSite(candidate: string, siteHost: string) {
  try {
    const url = new URL(candidate);
    return normalizeHost(url.hostname) === normalizeHost(siteHost);
  } catch {
    return false;
  }
}

export function classifyPage(url: string, title: string, text: string): KnowledgeContentType {
  const hay = `${url} ${title} ${text.slice(0, 400)}`.toLowerCase();
  if (/privacy|terms|refund|return|shipping|delivery|cookie/.test(hay)) return "POLICY";
  if (/\bfaq\b|frequently asked|help centre|help center/.test(hay)) return "FAQ";
  if (/\/product|\/item\//.test(url.toLowerCase())) return "PRODUCT";
  if (/pric|plan|package|service|booking|appointment|menu|rate/.test(hay)) return "SERVICE";
  return "PAGE";
}

export function stripHtml(html: string, maxChars: number) {
  const without = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, "\n$2\n")
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return decodeEntities(without)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, maxChars);
}

export function extractMeta(html: string, name: string) {
  const property = attrMatch(html, "property", name) || attrMatch(html, "name", name);
  return property;
}

export function extractTitle(html: string) {
  const og = extractMeta(html, "og:title");
  if (og) return og;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return collapse(decodeEntities(match?.[1] ?? ""));
}

export function extractHeadings(html: string, limit = 12) {
  const matches = [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
  return unique(
    matches
      .map((item) => collapse(stripHtml(item[1] ?? "", 160)))
      .filter((item) => item.length > 2),
  ).slice(0, limit);
}

export function extractLinks(html: string, baseUrl: string) {
  const hrefs = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map((item) => item[1] ?? "");
  const resolved: string[] = [];
  for (const href of [...hrefs, ...extractEmbeddedPaths(html)]) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }
    try {
      const url = new URL(href, baseUrl);
      url.hash = "";
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (normalizeHost(url.hostname) !== normalizeHost(new URL(baseUrl).hostname)) continue;
      resolved.push(url.toString().replace(/\/$/, "") || url.toString());
    } catch {
      /* skip */
    }
  }
  return unique(resolved);
}

export function extractContacts(text: string) {
  const emails = unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).slice(0, 8);
  const phones = unique(text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g) ?? [])
    .filter((item) => item.replace(/\D/g, "").length >= 8)
    .slice(0, 8);
  return { emails, phones };
}

export function parseSitemapUrls(xml: string, siteHost: string, limit: number) {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((item) => collapse(item[1] ?? ""));
  return unique(
    locs.filter((url) => isSafeHttpUrl(url) && sameSite(url, siteHost) && !/\.xml(\?|$)/i.test(url)),
  )
    .sort((a, b) => pathPriority(a) - pathPriority(b) || a.length - b.length)
    .slice(0, limit);
}

export function parseSitemapIndex(xml: string, siteHost: string, limit = 8) {
  if (!/<sitemapindex/i.test(xml) && !/<sitemap>/i.test(xml)) return [];
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((item) => collapse(item[1] ?? ""));
  return unique(locs.filter((url) => isSafeHttpUrl(url) && sameSite(url, siteHost) && /\.xml(\?|$)/i.test(url))).slice(
    0,
    limit,
  );
}

export function parseRobotsSitemaps(robots: string, siteHost: string) {
  const locs = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((item) => collapse(item[1] ?? ""));
  return unique(locs.filter((url) => isSafeHttpUrl(url) && sameSite(url, siteHost)));
}

export function extractPage(html: string, url: string, maxChars: number): ExtractedPage {
  const title = extractTitle(html) || url;
  const description =
    extractMeta(html, "og:description") || extractMeta(html, "description") || "";
  const headings = extractHeadings(html);
  const text = stripHtml(html, maxChars);
  const facts = pageFactsBlock(html, `${description}\n${headings.join("\n")}\n${text}`);
  const combined = [facts, description, headings.join("\n"), text].filter(Boolean).join("\n\n").slice(0, maxChars + 2500);
  const { emails, phones } = extractContacts(`${description}\n${combined}`);
  const links = extractLinks(html, url);
  return {
    url,
    title,
    description: collapse(description).slice(0, 320),
    headings,
    text: combined,
    emails,
    phones,
    links,
    contentType: classifyPage(url, title, `${description} ${combined}`),
    jsonLd: extractJsonLdNodes(html),
  };
}

export function guessServiceUrls(baseUrl: string, headings: string[], text: string) {
  const blob = `${headings.join(" ")} ${text}`.toLowerCase();
  const paths = new Set<string>();
  const add = (path: string) => {
    if (path.length > 2 && path.length < 64) paths.add(path);
  };

  if (/pric|rate|package/.test(blob)) {
    add("/pricing");
    add("/prices");
    add("/rates");
    add("/packages");
  }
  if (/service/.test(blob)) add("/services");
  if (/rental/.test(blob)) {
    add("/rentals");
    add("/rental");
  }
  if (/book|appoint/.test(blob)) {
    add("/book");
    add("/booking");
    add("/appointments");
  }
  if (/\bmenu\b/.test(blob)) add("/menu");
  if (/shop|store|product/.test(blob)) {
    add("/shop");
    add("/store");
    add("/products");
  }

  const skip = /^(about|subscribe|newsletter|home|welcome|contact|follow|instagram|facebook|copyright|privacy|terms)$/i;
  for (const heading of headings) {
    const slug = slugifyPath(heading);
    if (!slug || skip.test(slug) || slug.split("-").length > 8) continue;
    add(`/${slug}`);
    const trimmed = slug.replace(/-(packages?|rentals?|services?|plans?|pricing|rates?|offers?)$/i, "");
    if (trimmed && trimmed !== slug) {
      add(`/${trimmed}`);
      if (!trimmed.endsWith("s")) add(`/${trimmed}s`);
    }
  }

  const urls: string[] = [];
  for (const path of paths) {
    try {
      urls.push(new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString().replace(/\/$/, ""));
    } catch {
      /* skip */
    }
  }
  return urls;
}

function slugifyPath(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function extractEmbeddedPaths(html: string) {
  const paths: string[] = [];
  for (const match of html.matchAll(/"pageUriSEO"\s*:\s*"([^"]+)"/gi)) {
    const value = (match[1] ?? "").replace(/^\/+/, "");
    if (value && !/[\s<>]/.test(value)) paths.push(`/${value}`);
  }
  for (const match of html.matchAll(/"(?:url|href|link|path|route)"\s*:\s*"(\/[^"?#"]+)"/gi)) {
    const value = match[1] ?? "";
    if (value.length > 1 && value.length < 80 && !/^\/(_|api|_api)/i.test(value) && !/\.(js|css|png|jpe?g|gif|svg|woff2?)$/i.test(value)) {
      paths.push(value);
    }
  }
  return unique(paths);
}

export function chunkText(text: string, size = 1200, overlap = 120) {
  const sections = text
    .split(/\n(?=PRICES AND ITEMS FROM THIS PAGE:)|(?:\n{2,})/)
    .map((section) => section.replace(/[ \t]+/g, " ").trim())
    .filter((section) => section.length > 24);

  if (!sections.length) {
    const clean = collapse(text);
    return clean ? windowChunks(clean, size, overlap) : [];
  }

  const chunks: string[] = [];
  let current = "";
  for (const section of sections) {
    if (section.length > size) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...windowChunks(collapse(section), size, overlap));
      continue;
    }
    const next = current ? `${current}\n\n${section}` : section;
    if (next.length > size) {
      chunks.push(current);
      current = section;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 14);
}

function windowChunks(text: string, size: number, overlap: number) {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

function attrMatch(html: string, attr: string, name: string) {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${escapeReg(name)}["'][^>]*content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]*${attr}=["']${escapeReg(name)}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return collapse(decodeEntities(match?.[1] || match?.[2] || ""));
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function collapse(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
