import { prisma } from "@/lib/prisma";
import { INTENT_LABELS } from "@/modules/agents/team";
import type { AgentSpecialty, Prisma } from "@prisma/client";

export async function trackAnalyticsEvent(input: {
  organizationId: string;
  siteId?: string | null;
  type: string;
  payload?: Prisma.InputJsonValue;
}) {
  await prisma.analyticsEvent.create({
    data: {
      organizationId: input.organizationId,
      siteId: input.siteId || null,
      type: input.type,
      payload: input.payload ?? {},
    },
  });
}

export async function recordConversationTurn(input: {
  organizationId: string;
  siteId: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  intent: AgentSpecialty;
  greeting: boolean;
  handedOff: boolean;
  unanswered: boolean;
  leadCreated: boolean;
  offerHuman: boolean;
  question: string;
}) {
  try {
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: {
        lastMessageAt: new Date(),
        status: input.offerHuman && input.unanswered ? "ESCALATED" : input.unanswered ? "OPEN" : "RESOLVED",
      },
    });

    await trackAnalyticsEvent({
      organizationId: input.organizationId,
      siteId: input.siteId,
      type: "message_received",
      payload: {
        conversationId: input.conversationId,
        agentId: input.agentId,
        agentName: input.agentName,
        intent: input.intent,
        greeting: input.greeting,
      },
    });

    if (input.handedOff) {
      await trackAnalyticsEvent({
        organizationId: input.organizationId,
        siteId: input.siteId,
        type: "agent_handoff",
        payload: { conversationId: input.conversationId, agentId: input.agentId, agentName: input.agentName },
      });
    }

    if (input.leadCreated) {
      await trackAnalyticsEvent({
        organizationId: input.organizationId,
        siteId: input.siteId,
        type: "lead_created",
        payload: { conversationId: input.conversationId },
      });
    }

    if (input.unanswered && !input.greeting) {
      await trackAnalyticsEvent({
        organizationId: input.organizationId,
        siteId: input.siteId,
        type: "unanswered",
        payload: { conversationId: input.conversationId, question: input.question.slice(0, 180) },
      });
      await bumpImprovement({
        organizationId: input.organizationId,
        intent: input.intent,
        question: input.question,
      });
    }

    if (input.offerHuman && input.unanswered && !input.greeting) {
      const existing = await prisma.humanEscalation.findFirst({
        where: { conversationId: input.conversationId, status: "open" },
      });
      if (!existing) {
        await prisma.humanEscalation.create({
          data: {
            organizationId: input.organizationId,
            conversationId: input.conversationId,
            reason: "ai_uncertain",
            summary: input.question.slice(0, 240),
            status: "open",
          },
        });
      }
    }
  } catch {
    /* analytics must never break the visitor reply */
  }
}

async function bumpImprovement(input: { organizationId: string; intent: AgentSpecialty; question: string }) {
  const question = normalizeQuestion(input.question);
  if (!question) return;
  const topic = INTENT_LABELS[input.intent] || "General";
  const existing = await prisma.improvementSuggestion.findFirst({
    where: { organizationId: input.organizationId, status: "open", question },
  });
  if (existing) {
    await prisma.improvementSuggestion.update({
      where: { id: existing.id },
      data: { occurrences: { increment: 1 } },
    });
    return;
  }
  await prisma.improvementSuggestion.create({
    data: {
      organizationId: input.organizationId,
      topic,
      question,
      occurrences: 1,
      status: "open",
    },
  });
}

function normalizeQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s'@.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}
