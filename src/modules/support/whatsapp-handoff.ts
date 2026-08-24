import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/modules/ai/factory";
import { emailHandoffTranscript } from "@/modules/mail/resend";
import { publishRealtime } from "@/modules/realtime/publish";
import { publicSupportChannels } from "@/modules/support/channels";
import { buildWhatsAppHandoffText, buildWhatsAppUrl, condensedVisitorSummary } from "@/modules/support/whatsapp";

export async function startWhatsAppHandoff(input: {
  organizationId: string;
  siteId: string;
  conversationId: string;
}) {
  const [organization, conversation] = await Promise.all([
    prisma.organization.findFirst({
      where: { id: input.organizationId, deletedAt: null },
      select: { humanAgentWhatsapp: true },
    }),
    prisma.conversation.findFirst({
      where: { id: input.conversationId, organizationId: input.organizationId, siteId: input.siteId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 40, select: { role: true, content: true, metadata: true } },
      },
    }),
  ]);

  const channel = publicSupportChannels(organization?.humanAgentWhatsapp).whatsapp;
  if (!channel) {
    throw new Error("WhatsApp is not configured for this business.");
  }
  if (!conversation) throw new Error("Conversation not found");

  const usable = conversation.messages.filter((row) => {
    const meta = asRecord(row.metadata);
    return meta?.kind !== "lead" && meta?.kind !== "whatsapp_handoff";
  });
  const { question, summary } = await summarizeForHandoff(usable);
  const text = buildWhatsAppHandoffText({
    question,
    summary,
    conversationId: conversation.id,
  });
  const url = buildWhatsAppUrl(channel.e164, text);
  const at = new Date().toISOString();

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: conversation.status === "OPEN" ? "ESCALATED" : conversation.status,
      lastMessageAt: new Date(),
      metadata: {
        ...(typeof conversation.metadata === "object" && conversation.metadata && !Array.isArray(conversation.metadata)
          ? (conversation.metadata as Record<string, unknown>)
          : {}),
        whatsappHandoff: {
          at,
          to: channel.e164,
          summary,
          question,
          conversationId: conversation.id,
          visitorId: conversation.visitorId,
          customerId: conversation.customerId,
          channel: "whatsapp",
        },
      },
    },
  });

  const open = await prisma.humanEscalation.findFirst({
    where: { conversationId: conversation.id, status: "open" },
  });
  if (open) {
    await prisma.humanEscalation.update({
      where: { id: open.id },
      data: { summary: summary.slice(0, 240), reason: "whatsapp_handoff" },
    });
  } else {
    await prisma.humanEscalation.create({
      data: {
        organizationId: input.organizationId,
        conversationId: conversation.id,
        reason: "whatsapp_handoff",
        summary: summary.slice(0, 240),
        status: "open",
      },
    });
  }

  await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      role: "SYSTEM",
      content: "Visitor continued this conversation on WhatsApp.",
      metadata: {
        kind: "whatsapp_handoff",
        channel: "whatsapp",
        to: channel.e164,
        conversationId: conversation.id,
      },
    },
  });

  void emailHandoffTranscript({
    organizationId: input.organizationId,
    conversationId: conversation.id,
    reason: "whatsapp",
  }).catch(() => undefined);

  publishRealtime({
    type: "inbox",
    organizationId: input.organizationId,
    conversationId: conversation.id,
    payload: { whatsapp: true, to: channel.e164 },
  });

  return { url, text, e164: channel.e164 };
}

async function summarizeForHandoff(messages: { role: string; content: string }[]) {
  const fallback = condensedVisitorSummary(messages);
  try {
    const ai = await getAIProvider();
    const thread = messages
      .filter((row) => ["CUSTOMER", "AGENT", "HUMAN", "visitor", "agent"].includes(row.role))
      .slice(-16)
      .map((row) => {
        const who = row.role === "CUSTOMER" || row.role === "visitor" ? "Visitor" : "Assistant";
        return `${who}: ${row.content.replace(/\s+/g, " ").trim().slice(0, 400)}`;
      })
      .join("\n");
    const result = await ai.generate({
      temperature: 0.1,
      maxTokens: 180,
      system:
        "You write a short factual handoff note for a human support agent. Use only the conversation. Never invent names, prices, promises, or details. If something is unclear, omit it.",
      prompt: `Conversation:\n${thread}\n\nReturn exactly:\nQUESTION: <the visitor's main request, one sentence>\nSUMMARY: <two short sentences of what was discussed and why they need a person>`,
    });
    const question = pickLabeled(result.text, "QUESTION") || fallback.question;
    const summary = pickLabeled(result.text, "SUMMARY") || fallback.summary;
    return {
      question: question.slice(0, 280),
      summary: summary.replace(/\s+/g, " ").slice(0, 360),
    };
  } catch {
    return fallback;
  }
}

function pickLabeled(text: string, label: string) {
  const match = text.match(new RegExp(`${label}:\\s*([\\s\\S]+?)(?:\\n[A-Z]+:|$)`, "i"));
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
