import { NextResponse } from "next/server";
import { verifyWidgetInitToken } from "@/lib/security/widget-token";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing widget token" }, { status: 401 });
  }

  const claims = await verifyWidgetInitToken(token);
  if (!claims) {
    return NextResponse.json({ error: "Invalid widget token" }, { status: 401 });
  }

  const agent = await prisma.agent.findFirst({
    where: {
      id: claims.agentId,
      organizationId: claims.organizationId,
      siteId: claims.siteId,
    },
    include: { organization: true },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const suspended = agent.organization.accessStatus === "suspended";

  return NextResponse.json({
    name: agent.name,
    greeting: agent.widgetGreeting,
    primaryColor: agent.widgetPrimaryColor,
    avatarUrl: agent.widgetAvatarUrl,
    position: agent.widgetPosition,
    status: suspended ? "PAUSED" : agent.status,
  });
}
