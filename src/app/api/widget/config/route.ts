import { NextResponse } from "next/server";
import { verifyWidgetInitToken } from "@/lib/security/widget-token";
import { prisma } from "@/lib/prisma";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const instanceId = url.searchParams.get("instanceId");
  const site = url.searchParams.get("site");

  const agent = token
    ? await agentFromToken(token)
    : instanceId
      ? await agentFromInstance(instanceId)
      : site
        ? await agentFromSiteHost(site)
        : null;

  if (!agent) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404, headers: corsHeaders() });
  }

  const suspended = agent.organization.accessStatus === "suspended";

  return NextResponse.json(
    {
      name: agent.name,
      greeting: agent.widgetGreeting,
      primaryColor: agent.widgetPrimaryColor,
      avatarUrl: agent.widgetAvatarUrl,
      position: agent.widgetPosition,
      status: suspended ? "PAUSED" : agent.status,
    },
    { headers: corsHeaders() },
  );
}

async function agentFromToken(token: string) {
  const claims = await verifyWidgetInitToken(token);
  if (!claims) return null;
  return prisma.agent.findFirst({
    where: {
      id: claims.agentId,
      organizationId: claims.organizationId,
      siteId: claims.siteId,
    },
    include: { organization: true },
  });
}

async function agentFromInstance(instanceId: string) {
  const site = await prisma.wixSite.findUnique({
    where: { wixInstanceId: instanceId },
    include: {
      organization: true,
      agents: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  const agent = site?.agents[0];
  if (!agent || !site) return null;
  return { ...agent, organization: site.organization };
}

async function agentFromSiteHost(host: string) {
  const needle = normalizeHost(host);
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
  return { ...agent, organization: site.organization };
}

function normalizeHost(value?: string | null) {
  if (!value) return "";
  try {
    const host = new URL(value.includes("://") ? value : `https://${value}`).hostname;
    return host.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}
