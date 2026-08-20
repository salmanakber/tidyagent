import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/lib/security/session";

/**
 * Every tenant-owned query must go through a helper that binds organizationId
 * from the verified session — never from the browser.
 */
export function tenantWhere(session: AppSession) {
  return { organizationId: session.organizationId };
}

export async function getWorkspace(session: AppSession) {
  const organization = await prisma.organization.findFirst({
    where: { id: session.organizationId, deletedAt: null },
    include: {
      sites: {
        where: { id: session.siteId },
        take: 1,
      },
      subscriptions: {
        include: { plan: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      businessProfile: true,
      agents: {
        where: { siteId: session.siteId },
        include: {
          capabilities: true,
          rules: true,
          toolPermissions: true,
          workflows: true,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!organization) {
    throw new TenantAccessError();
  }

  const site = organization.sites[0];
  if (!site || site.id !== session.siteId) {
    throw new TenantAccessError();
  }

  const agents = organization.agents;
  if (agents.length && !agents.some((row) => row.isPrimary)) {
    await prisma.agent.update({
      where: { id: agents[0].id },
      data: { isPrimary: true },
    });
    agents[0] = { ...agents[0], isPrimary: true };
  }
  const agent = agents.find((row) => row.isPrimary) ?? agents[0] ?? null;

  return {
    organization,
    site,
    subscription: organization.subscriptions[0] ?? null,
    profile: organization.businessProfile,
    agent,
    agents,
  };
}

export async function scopedKnowledge(session: AppSession) {
  return prisma.knowledgeDocument.findMany({
    where: tenantWhere(session),
    orderBy: { createdAt: "desc" },
  });
}

export async function scopedConversations(session: AppSession) {
  return prisma.conversation.findMany({
    where: tenantWhere(session),
    include: {
      customer: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });
}

export async function scopedCustomers(session: AppSession) {
  return prisma.customer.findMany({
    where: tenantWhere(session),
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

/**
 * Vector retrieval MUST filter by organization before ranking.
 * This is the only allowed shape for similarity search.
 */
export async function retrieveKnowledgeChunks(input: {
  organizationId: string;
  siteId: string;
  embedding: number[];
  limit?: number;
}) {
  const limit = input.limit ?? 8;
  const vector = `[${input.embedding.join(",")}]`;

  return prisma.$queryRawUnsafe<
    { id: string; content: string; title: string | null; sourceUrl: string | null; contentType: string }[]
  >(
    `
    SELECT id, content, title, "sourceUrl", "contentType"
    FROM "KnowledgeChunk"
    WHERE "organizationId" = $1
      AND ("siteId" = $2 OR "siteId" IS NULL)
      AND embedding IS NOT NULL
    ORDER BY embedding <-> $3::vector
    LIMIT $4
    `,
    input.organizationId,
    input.siteId,
    vector,
    limit,
  );
}

export class TenantAccessError extends Error {
  constructor() {
    super("Tenant not found or access denied");
    this.name = "TenantAccessError";
  }
}
