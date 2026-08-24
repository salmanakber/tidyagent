import { prisma } from "@/lib/prisma";

export async function getPlatformOverview() {
  const [
    sites,
    connected,
    suspended,
    removed,
    subscriptions,
    conversations,
    escalations,
    knowledge,
    billingEvents,
  ] = await Promise.all([
    prisma.wixSite.count(),
    prisma.wixSite.count({ where: { connectionStatus: "connected" } }),
    prisma.organization.count({ where: { accessStatus: "suspended" } }),
    prisma.wixSite.count({ where: { connectionStatus: "removed" } }),
    prisma.subscription.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.conversation.count(),
    prisma.humanEscalation.count({ where: { status: "open" } }),
    prisma.knowledgeDocument.count(),
    prisma.billingEvent.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const latestByOrg = new Map<string, (typeof subscriptions)[number]>();
  for (const row of subscriptions) {
    if (!latestByOrg.has(row.organizationId)) latestByOrg.set(row.organizationId, row);
  }
  const latest = [...latestByOrg.values()];
  const planMix = {
    FREE: latest.filter((row) => row.planKey === "FREE" || row.isFree).length,
    STARTER: latest.filter((row) => !row.isFree && row.planKey === "STARTER").length,
    GROWTH: latest.filter((row) => !row.isFree && row.planKey === "GROWTH").length,
    PRO: latest.filter((row) => !row.isFree && row.planKey === "PRO").length,
  };
  const trials = latest.filter((row) => row.status === "TRIALING").length;
  const canceling = latest.filter((row) => row.cancelAtPeriodEnd).length;
  const pastDue = latest.filter((row) => row.billingIssue || row.status === "PAST_DUE").length;

  return {
    sites,
    connected,
    suspended,
    removed,
    conversations,
    escalations,
    knowledge,
    planMix,
    trials,
    canceling,
    pastDue,
    paidSeats: latest.filter((row) => !row.isFree).length,
    billingEvents,
  };
}

export async function listManagedSites() {
  const sites = await prisma.wixSite.findMany({
    include: {
      organization: {
        include: {
          subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
          agents: { take: 1 },
          _count: { select: { conversations: true, customers: true, knowledgeDocuments: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return sites.map((site) => {
    const subscription = site.organization.subscriptions[0];
    return {
      id: site.id,
      organizationId: site.organizationId,
      displayName: site.displayName || site.organization.name,
      url: site.url,
      ownerEmail: site.ownerEmail,
      connectionStatus: site.connectionStatus,
      accessStatus: site.organization.accessStatus,
      wixInstanceId: site.wixInstanceId,
      platform: site.platform,
      lastSyncedAt: site.lastSyncedAt,
      lastBillingSyncedAt: site.lastBillingSyncedAt,
      planKey: subscription?.planKey ?? "FREE",
      billingStatus: subscription?.status ?? "NONE",
      isFree: subscription?.isFree ?? true,
      compPlanKey: site.organization.compPlanKey,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      agentStatus: site.organization.agents[0]?.status ?? "DRAFT",
      conversations: site.organization._count.conversations,
      customers: site.organization._count.customers,
      knowledge: site.organization._count.knowledgeDocuments,
    };
  });
}

export async function getManagedSite(siteId: string) {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: {
      organization: {
        include: {
          subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } },
          agents: { take: 1 },
          businessProfile: true,
          _count: {
            select: {
              conversations: true,
              customers: true,
              knowledgeDocuments: true,
              humanEscalations: true,
            },
          },
        },
      },
    },
  });
  if (!site) return null;

  const events = await prisma.billingEvent.findMany({
    where: { wixInstanceId: site.wixInstanceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { site, events };
}

export async function getPlatformReports() {
  const sites = await listManagedSites();
  const improvements = await prisma.improvementSuggestion.findMany({
    where: { status: "open" },
    orderBy: { occurrences: "desc" },
    take: 12,
    include: { organization: true },
  });
  const audit = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const approachingLimit = sites.filter((site) => {
    const limit = site.planKey === "FREE" ? 100 : site.planKey === "STARTER" ? 1000 : 5000;
    return site.conversations / limit > 0.7;
  });

  return { sites, improvements, audit, approachingLimit };
}
