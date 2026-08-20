import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/security/session";
import { resolveWidgetAgent } from "@/modules/widget/resolve";
import { personPayload } from "@/modules/widget/avatar";

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
  const visitorId = url.searchParams.get("visitorId") || "";
  const conversationId = url.searchParams.get("conversationId");
  const token = url.searchParams.get("token");
  const instanceId = url.searchParams.get("instanceId");
  const site = url.searchParams.get("site");
  const preview = url.searchParams.get("preview") === "1";

  const session = preview ? await getSession() : null;
  const agent = await resolveWidgetAgent(
    session
      ? { organizationId: session.organizationId, siteId: session.siteId }
      : { token, instanceId, site },
  );
  if (!agent) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404, headers: corsHeaders() });
  }

  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: agent.organizationId,
        siteId: agent.siteId,
        ...(visitorId ? { visitorId } : {}),
      },
      include: {
        agent: true,
        messages: { orderBy: { createdAt: "asc" }, take: 80 },
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404, headers: corsHeaders() });
    }
    return NextResponse.json(
      {
        conversationId: conversation.id,
        agent: conversation.agent ? personPayload(conversation.agent) : null,
        messages: conversation.messages.map((row) => ({
          role: row.role === "CUSTOMER" ? "visitor" : "agent",
          text: row.content,
          createdAt: row.createdAt.toISOString(),
          agentName: asMeta(row.metadata).agentName,
        })),
      },
      { headers: corsHeaders() },
    );
  }

  if (!visitorId) {
    return NextResponse.json({ threads: [] }, { headers: corsHeaders() });
  }

  const rows = await prisma.conversation.findMany({
    where: { organizationId: agent.organizationId, siteId: agent.siteId, visitorId },
    orderBy: { lastMessageAt: "desc" },
    take: 24,
    include: {
      agent: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const firstVisitor = await prisma.message.findMany({
    where: {
      organizationId: agent.organizationId,
      conversationId: { in: rows.map((row) => row.id) },
      role: "CUSTOMER",
    },
    orderBy: { createdAt: "asc" },
    select: { conversationId: true, content: true },
  });
  const titles = new Map<string, string>();
  for (const row of firstVisitor) {
    if (!titles.has(row.conversationId)) titles.set(row.conversationId, row.content);
  }

  return NextResponse.json(
    {
      threads: rows.map((row) => ({
        id: row.id,
        title: titleFrom(titles.get(row.id)) || titleFrom(row.messages[0]?.content) || "Conversation",
        preview: row.messages[0]?.content?.slice(0, 90) || "",
        updatedAt: row.lastMessageAt.toISOString(),
        agent: row.agent ? personPayload(row.agent) : null,
      })),
    },
    { headers: corsHeaders() },
  );
}

function asMeta(value: unknown): { agentName?: string } {
  if (!value || typeof value !== "object") return {};
  const row = value as { agentName?: string };
  return { agentName: typeof row.agentName === "string" ? row.agentName : undefined };
}

function titleFrom(text?: string) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42).trim()}…` : clean;
}
