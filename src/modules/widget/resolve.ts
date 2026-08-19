import { prisma } from "@/lib/prisma";
import { verifyWidgetInitToken } from "@/lib/security/widget-token";

export type ResolvedWidgetAgent = NonNullable<Awaited<ReturnType<typeof loadAgentById>>>;

export async function resolveWidgetAgent(input: {
  token?: string | null;
  instanceId?: string | null;
  site?: string | null;
  organizationId?: string | null;
  siteId?: string | null;
}) {
  if (input.organizationId && input.siteId) {
    return prisma.agent.findFirst({
      where: { organizationId: input.organizationId, siteId: input.siteId },
      include: { organization: true, site: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (input.token) {
    const claims = await verifyWidgetInitToken(input.token);
    if (!claims) return null;
    return loadAgentById(claims.agentId, claims.organizationId, claims.siteId);
  }
  if (input.instanceId && !input.instanceId.includes("{")) {
    const site = await prisma.wixSite.findUnique({
      where: { wixInstanceId: input.instanceId },
      include: {
        organization: true,
        agents: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    const agent = site?.agents[0];
    if (!agent || !site) return null;
    return { ...agent, organization: site.organization, site };
  }
  if (input.site) {
    const needle = normalizeHost(input.site);
    if (!needle) return null;
    const sites = await prisma.wixSite.findMany({
      where: { connectionStatus: "connected" },
      include: {
        organization: true,
        agents: { orderBy: { createdAt: "asc" }, take: 1 },
      },
      take: 200,
    });
    const site = sites.find((row) => normalizeHost(row.url) === needle);
    const agent = site?.agents[0];
    if (!agent || !site) return null;
    return { ...agent, organization: site.organization, site };
  }
  return null;
}

function loadAgentById(id: string, organizationId: string, siteId: string) {
  return prisma.agent.findFirst({
    where: { id, organizationId, siteId },
    include: { organization: true, site: true },
  });
}

export function normalizeHost(value?: string | null) {
  if (!value) return "";
  try {
    const host = new URL(value.includes("://") ? value : `https://${value}`).hostname;
    return host.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}
