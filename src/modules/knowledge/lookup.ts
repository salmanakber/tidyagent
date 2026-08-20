import type { KnowledgeFactKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PRICE_Q = /price|pricing|cost|how much|fee|rate|package|plan|charge|quote|\$/i;
const CONTACT_Q = /phone|email|contact|address|where are you|located|location/i;
const HOURS_Q = /hour|open|close|when are you/i;
const POLICY_Q = /cancel|refund|return|policy|shipping|privacy|terms/i;
const BOOKING_Q = /book|reserv|schedule|appoint/i;

export async function lookupBusinessFacts(input: {
  organizationId: string;
  siteId: string;
  question: string;
}) {
  const kinds: KnowledgeFactKind[] = [];
  if (PRICE_Q.test(input.question)) kinds.push("PRICE", "PACKAGE", "PRODUCT", "SERVICE");
  if (CONTACT_Q.test(input.question)) kinds.push("CONTACT", "LOCATION");
  if (HOURS_Q.test(input.question)) kinds.push("HOURS");
  if (POLICY_Q.test(input.question)) kinds.push("POLICY");
  if (BOOKING_Q.test(input.question)) kinds.push("BOOKING");
  if (!kinds.length) kinds.push("PRICE", "CONTACT", "HOURS", "SERVICE", "PRODUCT");

  const [facts, conflicts] = await Promise.all([
    prisma.knowledgeFact.findMany({
      where: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        kind: { in: kinds },
      },
      take: 80,
      orderBy: { confidence: "asc" },
    }),
    prisma.knowledgeConflict.findMany({
      where: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        status: "OPEN",
      },
      take: 20,
    }),
  ]);

  const terms = input.question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !["the", "and", "for", "you", "can", "tell", "list", "have", "what", "price", "prices", "pricing", "cost"].includes(word));
  const matched = terms.length
    ? facts.filter((fact) => {
        const hay = `${fact.entity} ${fact.entityKey} ${fact.value}`.toLowerCase();
        return terms.some((term) => hay.includes(term) || fact.kind === "CONTACT" || fact.kind === "HOURS" || fact.kind === "LOCATION");
      })
    : facts;

  const ranked = (matched.length ? matched : facts).slice(0, 16);
  const conflictKeys = new Set(conflicts.map((row) => `${row.kind}:${row.entityKey}`));
  const openConflicts = conflicts.filter((row) =>
    ranked.some((fact) => fact.kind === row.kind && fact.entityKey === row.entityKey),
  );

  return {
    facts: ranked.map((fact) => ({
      kind: fact.kind,
      entity: fact.entity,
      value: fact.value,
      sourceUrl: fact.sourceUrl,
      confidence: fact.confidence,
      extractionMethod: fact.extractionMethod,
      conflicted: conflictKeys.has(`${fact.kind}:${fact.entityKey}`),
    })),
    conflicts: openConflicts.map((row) => ({
      entity: row.entity,
      kind: row.kind,
      values: row.values,
    })),
  };
}
