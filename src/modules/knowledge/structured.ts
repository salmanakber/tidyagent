import { createHash } from "crypto";
import type { KnowledgeConfidence, KnowledgeFactKind } from "@prisma/client";
import { extractLabeledPrices } from "@/modules/knowledge/facts";
import type { ExtractedPage } from "@/modules/knowledge/extract";

export type ExtractedFact = {
  kind: KnowledgeFactKind;
  entity: string;
  entityKey: string;
  value: string;
  sourceUrl: string;
  extractionMethod: "json-ld" | "html" | "wix-api" | "custom";
  confidence: KnowledgeConfidence;
};

export function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEntityKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an|our|your|rental|rentals|package|packages|service|services|plan|plans)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFactValue(value: string) {
  const money = value.replace(/,/g, "").match(/(?:USD|\$|€|£)?\s*(\d+(?:\.\d{1,2})?)/i);
  if (money?.[1] && /\$|usd|€|£|\d{2,}/i.test(value)) {
    return `$${money[1].replace(/\.00$/, "")}`;
  }
  return value.replace(/\s+/g, " ").trim();
}

export function factsFromPage(page: ExtractedPage): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const url = page.url;

  for (const line of extractLabeledPrices(`${page.headings.join("\n")}\n${page.text}`)) {
    const [entity, price] = splitLabeled(line);
    if (!entity || !price) continue;
    facts.push(makeFact("PRICE", entity, price, url, "html", "HIGH"));
  }

  for (const node of page.jsonLd ?? []) {
    facts.push(...factsFromJsonLdNode(node, url));
  }

  for (const phone of page.phones) {
    facts.push(makeFact("CONTACT", "phone", phone, url, "html", "HIGH"));
  }
  for (const email of page.emails) {
    facts.push(makeFact("CONTACT", "email", email.toLowerCase(), url, "html", "HIGH"));
  }

  const hours = page.text.match(/(?:opening hours|hours of operation|we(?:'re| are) open)[:\s]+([^\n.]{8,90})/i);
  if (hours?.[1]) {
    facts.push(makeFact("HOURS", "opening hours", hours[1].trim(), url, "html", "MEDIUM"));
  }

  if (page.contentType === "POLICY") {
    const snippet = page.text.replace(/\s+/g, " ").trim().slice(0, 280);
    if (snippet) facts.push(makeFact("POLICY", page.title.slice(0, 80), snippet, url, "html", "MEDIUM"));
  }

  return dedupeFacts(facts);
}

export function factsFromProduct(input: { name: string; price?: string; url?: string; description?: string }): ExtractedFact[] {
  const url = input.url || "";
  const facts: ExtractedFact[] = [makeFact("PRODUCT", input.name, input.description || input.name, url, "wix-api", "HIGH")];
  if (input.price) facts.push(makeFact("PRICE", input.name, input.price, url, "wix-api", "HIGH"));
  return facts;
}

export function detectFactConflicts(facts: ExtractedFact[]) {
  const groups = new Map<string, ExtractedFact[]>();
  for (const fact of facts) {
    if (fact.kind !== "PRICE" && fact.kind !== "HOURS" && fact.kind !== "CONTACT") continue;
    const key = `${fact.kind}:${fact.entityKey}`;
    const list = groups.get(key) ?? [];
    list.push(fact);
    groups.set(key, list);
  }

  const conflicts: {
    kind: ExtractedFact["kind"];
    entity: string;
    entityKey: string;
    values: { value: string; sourceUrl: string }[];
  }[] = [];

  for (const list of groups.values()) {
    const unique = new Map<string, ExtractedFact>();
    for (const fact of list) unique.set(normalizeFactValue(fact.value), fact);
    if (unique.size < 2) continue;
    const first = list[0];
    conflicts.push({
      kind: first.kind,
      entity: first.entity,
      entityKey: first.entityKey,
      values: [...unique.values()].map((fact) => ({ value: fact.value, sourceUrl: fact.sourceUrl })),
    });
  }
  return conflicts;
}

function factsFromJsonLdNode(node: Record<string, unknown>, url: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const type = String(node["@type"] || "").toLowerCase();
  const name = asString(node.name);
  const telephone = asString(node.telephone);
  const email = asString(node.email);
  const hours = asString(node.openingHours) || joinHours(node.openingHoursSpecification);
  const address = formatAddress(node.address);
  if (telephone) facts.push(makeFact("CONTACT", "phone", telephone, url, "json-ld", "HIGH"));
  if (email) facts.push(makeFact("CONTACT", "email", email, url, "json-ld", "HIGH"));
  if (hours) facts.push(makeFact("HOURS", "opening hours", hours, url, "json-ld", "HIGH"));
  if (address) facts.push(makeFact("LOCATION", "address", address, url, "json-ld", "HIGH"));
  if (name && /product|service|offer/.test(type)) {
    const price = asString((node.offers as Record<string, unknown> | undefined)?.price) || asString(node.price);
    if (price) facts.push(makeFact("PRICE", name, String(price), url, "json-ld", "HIGH"));
  }
  return facts;
}

function makeFact(
  kind: KnowledgeFactKind,
  entity: string,
  value: string,
  sourceUrl: string,
  extractionMethod: ExtractedFact["extractionMethod"],
  confidence: KnowledgeConfidence,
): ExtractedFact {
  return {
    kind,
    entity: entity.slice(0, 120),
    entityKey: normalizeEntityKey(entity) || normalizeEntityKey(kind),
    value: value.slice(0, 400),
    sourceUrl,
    extractionMethod,
    confidence,
  };
}

function splitLabeled(line: string) {
  const match = line.split(/\s+[—-]\s+/);
  return [match[0]?.trim() ?? "", match.slice(1).join(" — ").trim()] as const;
}

function asString(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function joinHours(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const spec = row as Record<string, unknown>;
      return [asString(spec.dayOfWeek), asString(spec.opens), asString(spec.closes)].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("; ");
}

function formatAddress(value: unknown) {
  if (!value || typeof value !== "object") return asString(value);
  const row = value as Record<string, unknown>;
  return [asString(row.streetAddress), asString(row.addressLocality), asString(row.addressRegion), asString(row.postalCode)].filter(Boolean).join(", ");
}

function dedupeFacts(facts: ExtractedFact[]) {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.kind}|${fact.entityKey}|${normalizeFactValue(fact.value)}|${fact.sourceUrl}`;
    if (seen.has(key) || !fact.entityKey || !fact.value) return false;
    seen.add(key);
    return true;
  });
}
