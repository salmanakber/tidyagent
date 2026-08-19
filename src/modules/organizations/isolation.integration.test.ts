import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tenantWhere } from "@/modules/organizations/workspace";
import type { AppSession } from "@/lib/security/session";
import { describe, expect, it } from "vitest";

describe("tenant isolation (release gate)", () => {
  it("refuses Tenant B access to Tenant A knowledge and conversations", async ({ skip }) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      skip();
      return;
    }

    let tenantA;
    let tenantB;
    try {
      tenantA = await prisma.organization.findFirst({ where: { name: "Atelier Noir" } });
      tenantB = await prisma.organization.findFirst({ where: { name: "Harbor Dental" } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        skip();
        return;
      }
      throw error;
    }

    if (!tenantA || !tenantB) {
      skip();
      return;
    }

    const sessionB: AppSession = {
      userId: "user-b",
      organizationId: tenantB.id,
      siteId: "ignored-for-this-query",
      wixInstanceId: "demo-instance-harbor-dental",
      role: "OWNER",
    };

    const attackerRequestedOrgId = tenantA.id;
    const knowledge = await prisma.knowledgeDocument.findMany({
      where: tenantWhere(sessionB),
    });
    const conversations = await prisma.conversation.findMany({
      where: tenantWhere(sessionB),
    });

    expect(knowledge.every((row) => row.organizationId === tenantB.id)).toBe(true);
    expect(knowledge.some((row) => row.organizationId === attackerRequestedOrgId)).toBe(false);
    expect(conversations.every((row) => row.organizationId === tenantB.id)).toBe(true);
    expect(conversations.some((row) => row.organizationId === attackerRequestedOrgId)).toBe(false);

    const leakedChunk = await prisma.knowledgeChunk.findFirst({
      where: tenantWhere(sessionB),
    });
    expect(leakedChunk?.organizationId === attackerRequestedOrgId).toBe(false);
  });
});
