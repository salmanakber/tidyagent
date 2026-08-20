import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { detectFactConflicts, type ExtractedFact } from "@/modules/knowledge/structured";

export async function persistSiteFacts(input: {
  organizationId: string;
  siteId: string;
  facts: ExtractedFact[];
  documents: { id: string; sourceUrl: string | null }[];
  crawlVersion: number;
}) {
  await prisma.knowledgeFact.deleteMany({
    where: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      extractionMethod: { not: "custom" },
    },
  });
  await prisma.knowledgeConflict.deleteMany({
    where: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      status: "OPEN",
    },
  });

  const byUrl = new Map(input.documents.filter((row) => row.sourceUrl).map((row) => [row.sourceUrl as string, row.id]));
  const data: Prisma.KnowledgeFactCreateManyInput[] = input.facts.map((fact) => ({
    organizationId: input.organizationId,
    siteId: input.siteId,
    documentId: fact.sourceUrl ? byUrl.get(fact.sourceUrl) ?? null : null,
    kind: fact.kind,
    entity: fact.entity,
    entityKey: fact.entityKey,
    value: fact.value,
    sourceUrl: fact.sourceUrl || null,
    extractionMethod: fact.extractionMethod,
    confidence: fact.confidence,
    crawlVersion: input.crawlVersion,
  }));

  if (data.length) {
    const batchSize = 80;
    for (let i = 0; i < data.length; i += batchSize) {
      await prisma.knowledgeFact.createMany({ data: data.slice(i, i + batchSize) });
    }
  }

  const conflicts = detectFactConflicts(input.facts);
  for (const conflict of conflicts) {
    await prisma.knowledgeConflict.upsert({
      where: {
        organizationId_siteId_kind_entityKey: {
          organizationId: input.organizationId,
          siteId: input.siteId,
          kind: conflict.kind,
          entityKey: conflict.entityKey,
        },
      },
      update: {
        entity: conflict.entity,
        values: conflict.values,
        status: "OPEN",
        resolvedValue: null,
      },
      create: {
        organizationId: input.organizationId,
        siteId: input.siteId,
        kind: conflict.kind,
        entity: conflict.entity,
        entityKey: conflict.entityKey,
        values: conflict.values,
        status: "OPEN",
      },
    });
  }

  return { facts: data.length, conflicts: conflicts.length };
}
