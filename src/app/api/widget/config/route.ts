import { NextResponse } from "next/server";
import { verifyWidgetInitToken } from "@/lib/security/widget-token";
import { prisma } from "@/lib/prisma";
import { getAppOrigin } from "@/lib/env";
import { entitlementsForOrganization } from "@/modules/billing/service";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
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
  const entitlements = await entitlementsForOrganization(agent.organization.id);
  const live = entitlements.isPaidSeat && !suspended && agent.status === "ACTIVE";

  const origin = getAppOrigin();
  const avatar = agent.widgetAvatarUrl
    ? agent.widgetAvatarUrl.startsWith("/")
      ? `${origin}${agent.widgetAvatarUrl}`
      : agent.widgetAvatarUrl.replace(/^http:\/\//, "https://")
    : null;

  return NextResponse.json(
    {
      name: agent.name,
      greeting: agent.widgetGreeting,
      primaryColor: agent.widgetPrimaryColor,
      useGradient: Boolean(agent.widgetUseGradient),
      gradientTo: agent.widgetGradientTo || "#4F8CFF",
      gradientAngle: agent.widgetGradientAngle || "to-bottom-right",
      textColor: agent.widgetTextColor || "#FFFFFF",
      messageColor: agent.widgetMessageColor || "#1E293B",
      avatarUrl: avatar,
      position: agent.widgetPosition,
      status: live ? agent.status : "LOCKED",
      template: agent.widgetTemplate || "CLASSIC",
      voiceEnabled: Boolean(live && entitlements.voiceEnabled && agent.voiceEnabled),
      voiceId: agent.voiceId || "en-US-Neural2-F",
      id: agent.id,
    },
    { headers: { ...corsHeaders(), "Cache-Control": "no-store" } },
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
      agents: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
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
      agents: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
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
