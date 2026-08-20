import { prisma } from "@/lib/prisma";
import { scanOrganizationSite } from "@/modules/knowledge/scanner";

const STALE_MS = 20 * 60 * 60 * 1000;

export async function refreshKnowledgeIfStale(input: {
  organizationId: string;
  siteId: string;
  wixInstanceId: string;
}) {
  const site = await prisma.wixSite.findFirst({
    where: { id: input.siteId, organizationId: input.organizationId },
    select: { lastSyncedAt: true },
  });
  const age = site?.lastSyncedAt ? Date.now() - site.lastSyncedAt.getTime() : STALE_MS + 1;
  if (age < STALE_MS) return { ran: false as const, reason: "fresh" };

  const source = await prisma.knowledgeSource.findFirst({
    where: { organizationId: input.organizationId, siteId: input.siteId, type: "site-scan" },
    select: { id: true, status: true },
  });
  if (source?.status === "scanning") return { ran: false as const, reason: "busy" };

  if (source) {
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: "scanning" },
    });
  }

  try {
    await scanOrganizationSite(input);
    return { ran: true as const };
  } catch (error) {
    if (source) {
      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { status: "ready" },
      }).catch(() => undefined);
    }
    throw error;
  }
}

export async function refreshStaleSites(limit = 12) {
  const cutoff = new Date(Date.now() - STALE_MS);
  const sites = await prisma.wixSite.findMany({
    where: {
      connectionStatus: { not: "removed" },
      organization: { accessStatus: { not: "suspended" } },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
    },
    select: { id: true, organizationId: true, wixInstanceId: true },
    take: limit,
    orderBy: { lastSyncedAt: "asc" },
  });

  const results: { siteId: string; ok: boolean; error?: string }[] = [];
  for (const site of sites) {
    try {
      await refreshKnowledgeIfStale({
        organizationId: site.organizationId,
        siteId: site.id,
        wixInstanceId: site.wixInstanceId,
      });
      results.push({ siteId: site.id, ok: true });
    } catch (error) {
      results.push({
        siteId: site.id,
        ok: false,
        error: error instanceof Error ? error.message : "scan failed",
      });
    }
  }
  return { scanned: results.length, results };
}
