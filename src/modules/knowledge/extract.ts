import type { KnowledgeContentType } from "@prisma/client";
import { pathPriority } from "@/modules/knowledge/scan-scope";

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
  if (/service|booking|appointment|menu/.test(hay)) return "SERVICE";
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
    .replace(/<\/(p|div|h1|h2|h3|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return collapse(decodeEntities(without)).slice(0, maxChars);
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
  const matches = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)];
  return unique(
    matches
      .map((item) => collapse(stripHtml(item[1] ?? "", 160)))
      .filter((item) => item.length > 2),
  ).slice(0, limit);
}

export function extractLinks(html: string, baseUrl: string) {
  const hrefs = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map((item) => item[1] ?? "");
  const resolved: string[] = [];
  for (const href of hrefs) {
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
    locs.filter((url) => isSafeHttpUrl(url) && sameSite(url, siteHost)),
  )
    .sort((a, b) => pathPriority(a) - pathPriority(b) || a.length - b.length)
    .slice(0, limit);
}

export function extractPage(html: string, url: string, maxChars: number): ExtractedPage {
  const title = extractTitle(html) || url;
  const description =
    extractMeta(html, "og:description") || extractMeta(html, "description") || "";
  const headings = extractHeadings(html);
  const text = stripHtml(html, maxChars);
  const { emails, phones } = extractContacts(`${description}\n${text}`);
  const links = extractLinks(html, url);
  return {
    url,
    title,
    description: collapse(description).slice(0, 320),
    headings,
    text,
    emails,
    phones,
    links,
    contentType: classifyPage(url, title, `${description} ${text}`),
  };
}

export function chunkText(text: string, size = 1200, overlap = 120) {
  const clean = collapse(text);
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + size);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.slice(0, 8);
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
