import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadHumanContact, type HumanContact } from "@/modules/handoff/human";
import { HANDOFF_WAIT_SECONDS } from "@/modules/handoff/live";
import { emailHandoffTranscript } from "@/modules/mail/resend";
import { publishRealtime, scheduleHandoffExpiry } from "@/modules/realtime/publish";
import { publicSupportChannels } from "@/modules/support/channels";
import type { ResolvedWidgetAgent } from "@/modules/widget/resolve";

import { humanUnavailableText } from "@/modules/handoff/copy";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function humanPerson(human: HumanContact) {
  return {
    id: human.id,
    name: human.name,
    role: human.role,
    specialty: human.specialty,
    avatarUrl: human.avatarUrl,
    voiceId: human.voiceId,
    human: true as const,
  };
}

/**
 * Visitor tapped “Talk with {name}”. Starts the wait, emails the team, and opens the inbox alert.
 */
export async function requestHumanFromWidget(input: {
  agent: ResolvedWidgetAgent;
  conversationId?: string | null;
  visitorId?: string | null;
  preview?: boolean;
}) {
  const human = await loadHumanContact(input.agent.organizationId);
  const support = publicSupportChannels(input.agent.organization.humanAgentWhatsapp);

  let conversation = input.conversationId
    ? await prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId: input.agent.organizationId,
          siteId: input.agent.siteId,
        },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        agentId: input.agent.id,
        visitorId: input.visitorId?.slice(0, 80) || null,
        metadata: { source: input.preview ? "preview" : "live" },
      },
    });
  }

  const aiPerson = {
    id: input.agent.id,
    name: input.agent.name,
    role: input.agent.role || "Assistant",
    specialty: input.agent.specialty || "GENERAL",
    avatarUrl: input.agent.widgetAvatarUrl,
    voiceId: input.agent.voiceId,
  };

  if (!human) {
    const text =
      "I can help you leave a note for the team, and they’ll follow up from there.";
    await prisma.message.create({
      data: {
        organizationId: input.agent.organizationId,
        conversationId: conversation.id,
        role: "AGENT",
        content: text,
        metadata: { agentId: input.agent.id, agentName: input.agent.name, options: true },
      },
    });
    return {
      conversationId: conversation.id,
      text,
      createdAt: new Date().toISOString(),
      wait: null as null,
      options: true,
      support,
      agent: aiPerson,
      handoff: null as null,
      live: false,
    };
  }

  const text = `I’m connecting you with ${human.name} now. Please stay on this chat for a moment.`;
  const meta = {
    ...asRecord(conversation.metadata),
    handedToHuman: true,
    needsLead: false,
    humanName: human.name,
    handoffStartedAt: new Date().toISOString(),
    waitSeconds: HANDOFF_WAIT_SECONDS,
  };

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "ESCALATED",
      lastMessageAt: new Date(),
      metadata: meta as Prisma.InputJsonValue,
    },
  });

  await prisma.message.create({
    data: {
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      role: "AGENT",
      content: text,
      metadata: {
        agentId: input.agent.id,
        agentName: input.agent.name,
        handoff: true,
        wait: true,
      },
    },
  });

  publishRealtime({
    type: "handoff",
    organizationId: input.agent.organizationId,
    conversationId: conversation.id,
    payload: {
      waiting: true,
      remaining: HANDOFF_WAIT_SECONDS,
      customer: "Visitor",
      preview: "Waiting to chat with the team",
      human: humanPerson(human),
    },
  });
  scheduleHandoffExpiry(conversation.id, HANDOFF_WAIT_SECONDS);
  void emailHandoffTranscript({
    organizationId: input.agent.organizationId,
    conversationId: conversation.id,
    reason: "waiting",
  }).catch(() => undefined);

  return {
    conversationId: conversation.id,
    text,
    createdAt: new Date().toISOString(),
    wait: { seconds: HANDOFF_WAIT_SECONDS, expired: false, human: humanPerson(human) },
    options: false,
    support,
    agent: aiPerson,
    handoff: { from: aiPerson, to: humanPerson(human) },
    live: true,
  };
}
