/** Pull prices, offers, and named items out of HTML so RAG can answer “how much?”. */

const PRICE_PATTERN =
  /(?:from\s+)?(?:USD|PKR|GBP|EUR|CAD|AUD|Rs\.?|£|€|\$)\s*[\d,]+(?:\.\d{1,2})?(?:\s?(?:\/|per)\s?(?:mo|month|yr|year|hr|hour|session|visit|week))?/gi;

const OFFER_PATTERN =
  /((?:\d+\s*\/\s*\d|\d+)?\s*(?:hour|hr|hours|day|night|half(?:[-\s]?day)?|full(?:[-\s]?day)?|week|session|minutes?)?\s*(?:rental|package|plan|session|tour|service|treatment|membership|class|lesson|offer|experience)[a-z0-9 +/&-]{0,40})\s[^$€£]{0,220}?((?:USD|PKR|GBP|EUR|CAD|AUD|Rs\.?|£|€|\$)\s*[\d,]+(?:\.\d{1,2})?)/gi;

export function extractJsonLdNodes(html: string): Record<string, unknown>[] {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes: Record<string, unknown>[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(decode(block[1] ?? "")) as unknown;
      walkJsonLd(parsed, nodes);
    } catch {
      /* skip broken JSON-LD */
    }
  }
  return nodes;
}

function walkJsonLd(value: unknown, out: Record<string, unknown>[], depth = 0) {
  if (!value || depth > 6) return;
  if (Array.isArray(value)) {
    for (const item of value) walkJsonLd(item, out, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  out.push(row);
  if (row["@graph"]) walkJsonLd(row["@graph"], out, depth + 1);
  if (row.offers) walkJsonLd(row.offers, out, depth + 1);
  if (row.itemListElement) walkJsonLd(row.itemListElement, out, depth + 1);
}

export function factsFromJsonLd(nodes: Record<string, unknown>[]): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const type = String(node["@type"] || "").toLowerCase();
    const name = asString(node.name);
    const url = asString(node.url);
    const price = offerPrice(node);
    const interesting =
      /product|service|offer|aggregateoffer|itemlist|event|menu|price/.test(type) || Boolean(price);
    if (!interesting) continue;
    const parts = [name, price, url].filter(Boolean);
    if (parts.length) lines.push(parts.join(" — "));
  }
  return unique(lines).slice(0, 40);
}

function offerPrice(node: Record<string, unknown>) {
  const direct =
    asString(node.price) ||
    asString(node.lowPrice) ||
    asString(node.highPrice) ||
    asString((node.priceSpecification as Record<string, unknown> | undefined)?.price);
  const currency = asString(node.priceCurrency) || asString(node.currency);
  if (direct) return currency ? `${currency} ${direct}` : direct;
  const offers = node.offers;
  if (offers && typeof offers === "object" && !Array.isArray(offers)) {
    return offerPrice(offers as Record<string, unknown>);
  }
  if (Array.isArray(offers) && offers[0] && typeof offers[0] === "object") {
    return offerPrice(offers[0] as Record<string, unknown>);
  }
  return "";
}

export function extractItempropPrices(html: string): string[] {
  const matches = [...html.matchAll(/itemprop=["']price["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*itemprop=["']price["']/gi)];
  return unique(matches.map((row) => row[1] || row[2] || "").filter(Boolean)).slice(0, 20);
}

export function extractVisiblePrices(text: string): string[] {
  return unique((text.match(PRICE_PATTERN) ?? []).map((item) => item.replace(/\s+/g, " ").trim())).slice(0, 30);
}

export function extractLabeledPrices(text: string): string[] {
  const hay = text.replace(/\s+/g, " ");
  const labeled: string[] = [];
  for (const match of hay.matchAll(OFFER_PATTERN)) {
    const name = collapse(match[1] ?? "");
    const price = collapse(match[2] ?? "");
    if (name.length >= 4 && price) labeled.push(`${titleCase(name)} — ${price}`);
  }

  const headings = text
    .split(/\n+/)
    .map((line) => collapse(line))
    .filter((line) => line.length >= 3 && line.length <= 80 && /[A-Za-z]/.test(line) && !PRICE_PATTERN.test(line));

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!/(hour|hr|day|night|rental|package|plan|session|tour|service|treatment|membership|class|lesson|offer|menu|product)/i.test(heading)) continue;
    const rest = text.slice(text.toLowerCase().indexOf(heading.toLowerCase()) + heading.length, text.toLowerCase().indexOf(heading.toLowerCase()) + heading.length + 280);
    const price = rest.match(PRICE_PATTERN)?.[0];
    if (price) labeled.push(`${titleCase(heading)} — ${collapse(price)}`);
  }

  return unique(labeled).slice(0, 40);
}

export function pageFactsBlock(html: string, visibleText: string): string {
  const jsonLd = factsFromJsonLd(extractJsonLdNodes(html));
  const labeled = extractLabeledPrices(visibleText);
  const itemprop = extractItempropPrices(html);
  const visible = extractVisiblePrices(visibleText);
  const lines = unique([...jsonLd, ...labeled, ...itemprop.map((price) => `Price ${price}`), ...visible]);
  if (!lines.length) return "";
  return `PRICES AND ITEMS FROM THIS PAGE:\n${lines.join("\n")}`;
}

function asString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter((item) => item.length > 1))];
}

function collapse(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}
