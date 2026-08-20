import type { AgentSpecialty, KnowledgeContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/modules/ai/factory";
import { retrieveKnowledgeChunks } from "@/modules/organizations/workspace";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { scanScopeForPlan } from "@/modules/knowledge/scan-scope";
import { classifyVisitorIntent, pickAgentForIntent } from "@/modules/agents/team";
import type { ResolvedWidgetAgent } from "@/modules/widget/resolve";

const OPENER =
  /^(hi+|hii+|hello|hey|hey there|hi there|good morning|good afternoon|good evening|howdy|yo|sup|what'?s up|how are you)\s*[!.?]*$/i;

export function isCasualOpener(text: string) {
  return OPENER.test(text.trim().replace(/[^\w\s'!?]/g, ""));
}

export async function replyToVisitor(input: {
  agent: ResolvedWidgetAgent;
  message: string;
  conversationId?: string | null;
  visitorId?: string | null;
  preview?: boolean;
}) {
  const message = input.message.trim().slice(0, 1200);
  if (!message) throw new Error("Message required");

  const entitlements = await entitlementsForOrganization(input.agent.organizationId);
  if (!entitlements.isPaidSeat) {
    throw new Error("A purchased plan is required.");
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const used = await prisma.conversation.count({
    where: { organizationId: input.agent.organizationId, startedAt: { gte: monthStart } },
  });
  if (used >= entitlements.conversationLimit) {
    return {
      conversationId: input.conversationId ?? null,
      text: "We’ve reached this month’s conversation limit. Please email the team and they’ll pick this up.",
    };
  }

  const conversation = await getOrCreateConversation(input);
  const team = await prisma.agent.findMany({
    where: { organizationId: input.agent.organizationId, siteId: input.agent.siteId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  const current =
    team.find((row) => row.id === conversation.agentId) ??
    team.find((row) => row.isPrimary) ??
    input.agent;
  const intent = isCasualOpener(message) ? "GENERAL" : classifyVisitorIntent(message);
  const routed = pickAgentForIntent(team, intent) ?? current;
  const handedOff = routed.id !== current.id && !isCasualOpener(message);

  if (handedOff) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { agentId: routed.id },
    });
  }

  await prisma.message.create({
    data: {
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: message,
    },
  });

  const profile = await prisma.businessProfile.findUnique({
    where: { organizationId: input.agent.organizationId },
  });
  const businessName = profile?.name || input.agent.site.displayName || "our team";
  const scope = scanScopeForPlan(entitlements.planKey);
  const evidence = isCasualOpener(message)
    ? []
    : await gatherEvidence({
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        question: message,
        includeStores: scope.includeStores,
        contentTypes: routed.knowledgeScopes as KnowledgeContentType[],
      });

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id, organizationId: input.agent.organizationId },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  const text = await generateReply({
    agentName: routed.name,
    role: routed.role,
    personality: routed.personality,
    specialty: routed.specialty,
    businessName,
    summary: profile?.summary || "",
    industry: profile?.industry || "",
    question: message,
    greeting: isCasualOpener(message),
    evidence,
    history: history.map((row) => ({ role: row.role, content: row.content })),
    handoffFrom: handedOff ? current.name : null,
  });

  await prisma.message.create({
    data: {
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      role: "AGENT",
      content: text,
      evidence: evidence.map((item) => ({ title: item.title, sourceUrl: item.sourceUrl })),
      metadata: {
        agentId: routed.id,
        agentName: routed.name,
        agentRole: routed.role,
        specialty: routed.specialty,
        handoff: handedOff,
      },
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  return {
    conversationId: conversation.id,
    text,
    createdAt: new Date().toISOString(),
    agent: {
      id: routed.id,
      name: routed.name,
      role: routed.role,
      specialty: routed.specialty,
      avatarUrl: routed.widgetAvatarUrl,
    },
    handoff: handedOff
      ? {
          from: { id: current.id, name: current.name, role: current.role, specialty: current.specialty, avatarUrl: current.widgetAvatarUrl },
          to: { id: routed.id, name: routed.name, role: routed.role, specialty: routed.specialty, avatarUrl: routed.widgetAvatarUrl },
        }
      : null,
  };
}

async function getOrCreateConversation(input: {
  agent: ResolvedWidgetAgent;
  conversationId?: string | null;
  visitorId?: string | null;
  preview?: boolean;
}) {
  if (input.conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: {
        id: input.conversationId,
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
      },
    });
    if (existing) return existing;
  }
  return prisma.conversation.create({
    data: {
      organizationId: input.agent.organizationId,
      siteId: input.agent.siteId,
      agentId: input.agent.id,
      visitorId: input.visitorId?.slice(0, 80) || null,
      metadata: { source: input.preview ? "preview" : "live" },
    },
  });
}

async function gatherEvidence(input: {
  organizationId: string;
  siteId: string;
  question: string;
  includeStores: boolean;
  contentTypes?: KnowledgeContentType[];
}) {
  const scopedTypes = (input.contentTypes ?? []).filter(Boolean);
  const contentTypeWhere = scopedTypes.length
    ? { contentType: { in: scopedTypes } }
    : input.includeStores
      ? {}
      : { contentType: { not: "PRODUCT" as KnowledgeContentType } };
  const terms = input.question
    .replace(/[%_]/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/[^\w'-]/g, ""))
    .filter((word) => word.length >= 3)
    .slice(0, 6);

  const keywordHits =
    terms.length === 0
      ? []
      : await prisma.knowledgeChunk.findMany({
          where: {
            organizationId: input.organizationId,
            siteId: input.siteId,
            ...contentTypeWhere,
            OR: terms.flatMap((term) => [
              { content: { contains: term, mode: "insensitive" as const } },
              { title: { contains: term, mode: "insensitive" as const } },
            ]),
          },
          take: 8,
          select: { content: true, title: true, sourceUrl: true, contentType: true },
        });

  let vectorHits: { content: string; title: string | null; sourceUrl: string | null; contentType: string }[] = [];
  try {
    const ai = await getAIProvider();
    const embedded = await ai.embed({ texts: [input.question.slice(0, 1000)] });
    const vector = embedded.embeddings[0];
    if (vector?.length === 768) {
      vectorHits = await retrieveKnowledgeChunks({
        organizationId: input.organizationId,
        siteId: input.siteId,
        embedding: vector,
        limit: 6,
      });
    }
  } catch {
    /* keyword hits still used */
  }

  const merged = [...keywordHits, ...vectorHits]
    .filter((row) => {
      if (scopedTypes.length) return scopedTypes.includes(row.contentType as KnowledgeContentType);
      return input.includeStores || row.contentType !== "PRODUCT";
    })
    .reduce(
      (acc, row) => {
        const key = `${row.title}|${row.content.slice(0, 80)}`;
        if (!acc.map.has(key)) {
          acc.map.set(key, true);
          acc.list.push({
            content: row.content,
            title: row.title,
            sourceUrl: row.sourceUrl,
            contentType: row.contentType,
          });
        }
        return acc;
      },
      {
        map: new Map<string, boolean>(),
        list: [] as { content: string; title: string | null; sourceUrl: string | null; contentType: string }[],
      },
    ).list;

  if (merged.length) return merged.slice(0, 8);

  return prisma.knowledgeChunk.findMany({
    where: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      ...contentTypeWhere,
    },
    take: 6,
    orderBy: { createdAt: "desc" },
    select: { content: true, title: true, sourceUrl: true, contentType: true },
  });
}

async function generateReply(input: {
  agentName: string;
  role: string;
  personality: string;
  specialty: AgentSpecialty;
  businessName: string;
  summary: string;
  industry: string;
  question: string;
  greeting: boolean;
  evidence: { content: string; title: string | null; sourceUrl: string | null }[];
  history: { role: string; content: string }[];
  handoffFrom: string | null;
}) {
  const intro = input.handoffFrom
    ? `The visitor was just transferred to you from ${input.handoffFrom}. Do not mention the transfer, introductions, or that you were connected. Answer the question immediately as ${input.agentName}.`
    : "";
  const fallback = input.greeting
    ? `Hi — I’m ${input.agentName} with ${input.businessName}. How can I help you today?`
    : input.evidence.length
      ? answerFromEvidence(input.question, input.evidence)
      : `I don’t have that on file for ${input.businessName} yet. I can connect you with the team to confirm.`;

  try {
    const ai = await getAIProvider();
    const evidenceBlock = input.evidence
      .map((item, index) => `${index + 1}. ${item.title || "Source"}${item.sourceUrl ? ` (${item.sourceUrl})` : ""}\n${item.content.slice(0, 1200)}`)
      .join("\n\n");
    const historyBlock = input.history
      .slice(-8)
      .map((row) => `${row.role === "CUSTOMER" ? "Visitor" : "Agent"}: ${row.content}`)
      .join("\n");
    const result = await ai.generate({
      temperature: input.greeting ? 0.4 : 0.2,
      maxTokens: 420,
      system: `You are ${input.agentName}, ${input.role} for ${input.businessName}. Tone: ${input.personality || "friendly"}.
Specialty: ${input.specialty}. Stay inside that specialty and the evidence. If the question belongs to another team, say you are connecting them.
You are a real customer-service employee for this Wix business, not a generic chatbot.
Never invent prices, policies, hours, or products. Use only the business profile and evidence.
${intro}
If the visitor is simply greeting you, welcome them by name of the business and invite a specific question. Do not say you lack verified information for a greeting.
If the question needs facts you do not have, say so plainly and offer a human handoff.`,
      prompt: `Business: ${input.businessName}
Industry: ${input.industry || "unknown"}
Profile: ${input.summary || "none"}

Evidence from the site (this agent’s assigned data only):
${evidenceBlock || "(none retrieved)"}

Recent thread:
${historyBlock}

Visitor just said: ${input.question}

Reply in 1-4 short sentences.`,
    });
    const text = result.text.trim();
    if (text) return text.slice(0, 1600);
  } catch {
    /* use fallback */
  }
  return fallback;
}

function answerFromEvidence(question: string, evidence: { content: string; title: string | null }[]) {
  const hay = `${evidence[0]?.title ?? ""} ${evidence[0]?.content ?? ""}`.replace(/\s+/g, " ").trim();
  if (!hay) return "I can look that up with the team if you’d like.";
  return hay.slice(0, 420);
}
