import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { HANDOFF_WAIT_SECONDS, handoffState } from "@/modules/handoff/live";
import { publishRealtime } from "@/modules/realtime/publish";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { organizationId: session.organizationId, siteId: session.siteId, status: "ESCALATED" },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 8 },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    waitSeconds: HANDOFF_WAIT_SECONDS,
    conversations: conversations.map((row) => {
      const state = handoffState(row.metadata);
      const last = row.messages[0];
      return {
        id: row.id,
        waiting: !state.joined,
        joined: state.joined,
        remaining: state.remaining,
        customer: row.customer?.name || row.customer?.email || "Visitor",
        preview: last?.content?.slice(0, 120) || "",
        lastMessageAt: row.lastMessageAt.toISOString(),
        messages: [...row.messages].reverse().map((message) => ({
          id: message.id,
          role: message.role,
          text: message.content,
          at: message.createdAt.toISOString(),
        })),
      };
    }),
  });
}

const replySchema = z.object({
  conversationId: z.string().min(8).max(80),
  text: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  let parsed: z.infer<typeof replySchema>;
  try {
    parsed = replySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: parsed.conversationId, organizationId: session.organizationId, siteId: session.siteId },
  });
  if (!conversation) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const organization = await prisma.organization.findFirst({
    where: { id: session.organizationId },
    select: { humanAgentName: true, humanAgentRole: true, humanAgentAvatarUrl: true },
  });
  const name = organization?.humanAgentName?.trim() || session.name || "Team";
  const meta = (conversation.metadata && typeof conversation.metadata === "object" && !Array.isArray(conversation.metadata)
    ? conversation.metadata
    : {}) as Record<string, unknown>;
  const firstJoin = !meta.humanJoinedAt;
  const text = parsed.text.trim();

  if (firstJoin) {
    await prisma.message.create({
      data: {
        organizationId: session.organizationId,
        conversationId: conversation.id,
        role: "AGENT",
        content: `${name} joined`,
        metadata: { kind: "joined", human: true, agentName: name },
      },
    });
  }

  const message = await prisma.message.create({
    data: {
      organizationId: session.organizationId,
      conversationId: conversation.id,
      role: "HUMAN",
      content: text,
      metadata: {
        kind: "human",
        agentName: name,
        agentRole: organization?.humanAgentRole || "Team",
        avatarUrl: organization?.humanAgentAvatarUrl || null,
        human: true,
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "ESCALATED",
      lastMessageAt: new Date(),
      metadata: { ...meta, handedToHuman: true, humanJoinedAt: meta.humanJoinedAt || new Date().toISOString(), humanName: name },
    },
  });

  const human = {
    name,
    role: organization?.humanAgentRole || "Team",
    avatarUrl: organization?.humanAgentAvatarUrl || null,
    human: true,
  };
  if (firstJoin) {
    publishRealtime({
      type: "joined",
      organizationId: session.organizationId,
      conversationId: conversation.id,
      payload: { human },
    });
  }
  publishRealtime({
    type: "message",
    organizationId: session.organizationId,
    conversationId: conversation.id,
    payload: {
      human,
      message: { id: message.id, role: "HUMAN", text: message.content, at: message.createdAt.toISOString() },
    },
  });

  return NextResponse.json({
    ok: true,
    joined: true,
    greeting: firstJoin,
    message: { id: message.id, role: "HUMAN", text: message.content, at: message.createdAt.toISOString() },
  });
}
