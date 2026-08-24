import type { AgentSpecialty, KnowledgeContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/modules/ai/factory";
import { retrieveKnowledgeChunks } from "@/modules/organizations/workspace";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { getPlanScope } from "@/modules/billing/plan-scope-store";
import { scanScopeFromConfig } from "@/modules/knowledge/scan-scope";
import { lookupBusinessFacts } from "@/modules/knowledge/lookup";
import { extractLabeledPrices, cleanOfferName } from "@/modules/knowledge/facts";
import { classifyVisitorIntent, pickAgentForIntent } from "@/modules/agents/team";
import { isWorkflowOn, type AutomationKey, automationAllowedForEntitlements } from "@/modules/automations/catalog";
import type { ResolvedWidgetAgent } from "@/modules/widget/resolve";
import { reportPrimaryAction } from "@/modules/wix/bi-events";
import { loadHumanContact } from "@/modules/handoff/human";
import { HANDOFF_WAIT_SECONDS, handoffState } from "@/modules/handoff/live";
import { emailHandoffTranscript } from "@/modules/mail/resend";
import { publishRealtime, scheduleHandoffExpiry } from "@/modules/realtime/publish";
import { loadCatalogCards, type CatalogCard } from "@/modules/knowledge/catalog-cards";
import { liveLookupForQuestion } from "@/modules/knowledge/live-lookup";
import {
  expandTerms,
  isBookingRequest,
  isHandoffRequest,
  isJunkBusinessName,
  questionTerms,
  textMatchesTerms,
} from "@/modules/knowledge/match";
import { rewriteChatLinks } from "@/modules/widget/chat-links";
import { answerTidyAgentQuestion, isTidyAgentQuestion } from "@/modules/product/about";

const OPENER =
  /^(hi+|hii+|hello|hey|hey there|hi there|good morning|good afternoon|good evening|howdy|yo|sup|what'?s up|how are you)\s*[!.?]*$/i;

export function isCasualOpener(text: string) {
  return OPENER.test(text.trim().replace(/[^\w\s'!?]/g, ""));
}

export function isFollowUp(text: string) {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s'?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  if (
    /^(and|also|what about|how about|how much|the other|that one|this one|those|them|yes|yep|yeah|nope|no|ok|okay|same|another|more|which one)\b/.test(
      t,
    )
  ) {
    return true;
  }
  const words = t.split(" ").filter(Boolean);
  return words.length <= 8 && /\b(that|those|them|it|this one|the other|same|too|as well)\b/.test(t) && subjectTerms(t).length < 2;
}

export function searchQueryFromThread(current: string, previousCustomer: string[]) {
  if (!previousCustomer.length || !isFollowUp(current)) return current;
  return `${previousCustomer.slice(-2).join(" ")} ${current}`.replace(/\s+/g, " ").trim().slice(0, 400);
}

export function isPriceQuestion(text: string) {
  return /price|pricing|cost|how much|fee|rate|package|plan|charge|quote|\$/.test(text.toLowerCase());
}

export function isSensitiveQuestion(text: string) {
  return /price|pricing|cost|how much|fee|rate|package|plan|plans|charge|quote|subscription|subscribe|membership|deposit|discount|promo|tuition|\$|usd|pkr|eur|gbp/.test(
    text.toLowerCase(),
  );
}

export function subjectTerms(text: string) {
  return expandTerms(questionTerms(text));
}

export { isHandoffRequest };

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

  const { conversation: started, created } = await getOrCreateConversation(input);
  let conversation = started;
  if (created && !input.preview) {
    reportPrimaryAction(input.agent.site.wixInstanceId);
  }

  const human = await loadHumanContact(input.agent.organizationId);
  const state = handoffState(conversation.metadata);
  const liveWithHuman =
    Boolean(human) && (state.joined || (conversation.status === "ESCALATED" && !state.expired));
  if (liveWithHuman) {
    const visitorMessage = await prisma.message.create({
      data: {
        organizationId: input.agent.organizationId,
        conversationId: conversation.id,
        role: "CUSTOMER",
        content: message,
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
    publishRealtime({
      type: "message",
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      payload: {
        message: {
          id: visitorMessage.id,
          role: "CUSTOMER",
          text: message,
          at: visitorMessage.createdAt.toISOString(),
        },
      },
    });
    const liveState = handoffState(conversation.metadata);
    if (liveState.joined && human) {
      return {
        conversationId: conversation.id,
        text: "",
        live: true,
        createdAt: new Date().toISOString(),
        products: [],
        leadForm: false,
        wait: null,
        agent: humanPerson(human),
        handoff: null,
      };
    }
    return {
      conversationId: conversation.id,
      text: "",
      live: true,
      createdAt: new Date().toISOString(),
      products: [],
      leadForm: false,
      wait: { seconds: liveState.remaining, expired: false, human: humanPerson(human!) },
      agent: humanPerson(human!),
      handoff: null,
    };
  }

  if (conversation.status === "ESCALATED" && !state.joined) {
    const meta = {
      ...(asRecord(conversation.metadata) ?? {}),
      handedToHuman: false,
      resumedAiAt: new Date().toISOString(),
    };
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "OPEN", metadata: meta },
    });
    conversation = { ...conversation, status: "OPEN", metadata: meta };
  }
  const team = await prisma.agent.findMany({
    where: { organizationId: input.agent.organizationId, siteId: input.agent.siteId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
  const primary = team.find((row) => row.isPrimary) ?? team[0] ?? null;
  const workflows = primary
    ? await prisma.agentWorkflow.findMany({
        where: { agentId: primary.id, organizationId: input.agent.organizationId },
      })
    : [];
  const on = (key: AutomationKey) => {
    if (!automationAllowedForEntitlements(entitlements, key)) return false;
    return isWorkflowOn(workflows, key, true);
  };

  const current =
    team.find((row) => row.id === conversation.agentId) ??
    team.find((row) => row.isPrimary) ??
    input.agent;
  const priorRows = await prisma.message.findMany({
    where: { conversationId: conversation.id, organizationId: input.agent.organizationId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { role: true, content: true, metadata: true },
  });
  const timeline = priorRows
    .reverse()
    .filter((row) => (row.metadata as { kind?: string } | null)?.kind !== "handoff")
    .map((row) => ({ role: row.role, content: row.content }));
  const priorCustomer = timeline.filter((row) => row.role === "CUSTOMER").map((row) => row.content);
  const aboutProduct = isTidyAgentQuestion(message, priorCustomer);
  const greetingTurn = isCasualOpener(message) && on("greeting") && priorCustomer.length === 0 && !aboutProduct;
  const searchQuery = searchQueryFromThread(message, priorCustomer);
  const intent = greetingTurn ? "GENERAL" : classifyVisitorIntent(searchQuery);
  let routed = current;
  if (on("specialist_routing") && !greetingTurn && !(intent === "ECOMMERCE" && !on("shopping"))) {
    routed = pickAgentForIntent(team, intent) ?? current;
  }
  const handedOff = routed.id !== current.id && !greetingTurn;

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

  let leadCreated = false;
  if (on("lead_capture")) {
    leadCreated = Boolean(
      await captureLeadEmail({
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        conversationId: conversation.id,
        message,
      }),
    );
  }

  if (handedOff) {
    await prisma.message.create({
      data: {
        organizationId: input.agent.organizationId,
        conversationId: conversation.id,
        role: "AGENT",
        content: `${routed.name} joined`,
        metadata: {
          kind: "handoff",
          agentId: routed.id,
          agentName: routed.name,
          from: {
            id: current.id,
            name: current.name,
            role: current.role,
            specialty: current.specialty,
            avatarUrl: current.widgetAvatarUrl,
          },
          to: {
            id: routed.id,
            name: routed.name,
            role: routed.role,
            specialty: routed.specialty,
            avatarUrl: routed.widgetAvatarUrl,
          },
        },
      },
    });
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { organizationId: input.agent.organizationId },
  });
  const businessName = cleanBusinessName(profile?.name, input.agent.site.displayName);
  const planScope = await getPlanScope(entitlements.planKey);
  const scope = scanScopeFromConfig(entitlements.planKey, planScope);
  const assignedScopes = (routed.knowledgeScopes as KnowledgeContentType[]).filter((item) =>
    on("shopping") ? true : item !== "PRODUCT",
  );
  if (isPriceQuestion(searchQuery) || isSensitiveQuestion(searchQuery) || isBookingRequest(searchQuery) || isPriceQuestion(message) || isSensitiveQuestion(message) || isBookingRequest(message)) {
    if (!assignedScopes.includes("SERVICE")) assignedScopes.push("SERVICE");
    if (!assignedScopes.includes("CUSTOM")) assignedScopes.push("CUSTOM");
    if (!assignedScopes.includes("FAQ")) assignedScopes.push("FAQ");
    if (scope.includeStores && on("shopping") && !assignedScopes.includes("PRODUCT")) {
      assignedScopes.push("PRODUCT");
    }
  }
  const wantsHuman = isHandoffRequest(message);
  const structured = greetingTurn || aboutProduct
    ? { facts: [], conflicts: [] }
    : await lookupBusinessFacts({
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        question: searchQuery,
      });

  let evidence = greetingTurn || aboutProduct
    ? []
    : await gatherEvidence({
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        question: searchQuery,
        includeStores: scope.includeStores && on("shopping"),
        contentTypes: assignedScopes,
      });

  const ownerNotes = greetingTurn || aboutProduct
    ? []
    : await loadOwnerNotes(input.agent.organizationId, input.agent.siteId);

  let products = greetingTurn || aboutProduct
    ? []
    : await loadCatalogCards({
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        question: searchQuery,
        includeStores: scope.includeStores,
      });

  const thin =
    !aboutProduct &&
    !greetingTurn &&
    !wantsHuman &&
    evidence.length < 2 &&
    structured.facts.filter((fact) => !fact.conflicted && textMatchesTerms(`${fact.entity} ${fact.value}`, subjectTerms(searchQuery))).length === 0 &&
    products.length === 0;

  if (thin) {
    const live = await liveLookupForQuestion({
      organizationId: input.agent.organizationId,
      siteId: input.agent.siteId,
      siteUrl: input.agent.site.url,
      question: searchQuery,
    });
    if (live.length) evidence = rankEvidence(searchQuery, [...live, ...evidence]).slice(0, 8);
  }

  const hour = new Date().getUTCHours();
  const afterHours = on("after_hours") && (hour >= 20 || hour < 8);

  const matchedFacts = structured.facts.filter(
    (fact) => !fact.conflicted && textMatchesTerms(`${fact.entity} ${fact.value}`, subjectTerms(searchQuery)),
  );
  const sensitive = isSensitiveQuestion(searchQuery) || isSensitiveQuestion(message);
  if (sensitive) {
    const itemTerms = subjectTerms(searchQuery).filter(
      (term) => !["price", "prices", "pricing", "cost", "list", "plan", "plans", "how", "much", "fee", "rate"].includes(term),
    );
    if (itemTerms.length) {
      products = products.filter((card) => Boolean(card.price) && textMatchesTerms(`${card.name} ${card.price ?? ""}`, itemTerms));
    } else {
      products = products.filter((card) => Boolean(card.price));
    }
  }
  const factsForReply = sensitive ? matchedFacts : matchedFacts.length ? matchedFacts : structured.facts;
  const unanswered =
    !aboutProduct &&
    !greetingTurn &&
    !wantsHuman &&
    evidence.length === 0 &&
    matchedFacts.length === 0 &&
    ownerNotes.length === 0 &&
    products.length === 0;

  const escalateNow = Boolean(wantsHuman || (unanswered && on("human_handoff")));
  const humanHandoff = Boolean(escalateNow && human);
  const leadForm = Boolean(escalateNow && !human) || Boolean(isBookingRequest(message) && unanswered && !human);

  let text = humanHandoff
    ? `Connecting you with ${human!.name}…`
    : leadForm
      ? "I can’t finish this in chat. Leave your name and how to reach you — the team will follow up from this conversation."
      : aboutProduct
        ? await answerTidyAgentQuestion(message)
        : await generateReply({
          agentName: routed.name,
          role: routed.role,
          personality: routed.personality,
          specialty: routed.specialty,
          businessName,
          summary: profile?.summary || "",
          industry: profile?.industry || "",
          question: message,
          lookup: searchQuery,
          greeting: greetingTurn,
          evidence,
          structured: { ...structured, facts: factsForReply, conflicts: [] },
          ownerNotes,
          history: timeline,
          handoffFrom: handedOff ? current.name : null,
          offerHuman: on("human_handoff") && Boolean(human),
          humanName: human?.name ?? null,
          afterHours,
          products,
          sensitive,
        });

  if (humanHandoff && human) {
    await prisma.message.create({
      data: {
        organizationId: input.agent.organizationId,
        conversationId: conversation.id,
        role: "AGENT",
        content: `${human.name} joined`,
        metadata: {
          kind: "handoff",
          human: true,
          agentName: human.name,
          from: {
            id: routed.id,
            name: routed.name,
            role: routed.role,
            specialty: routed.specialty,
            avatarUrl: routed.widgetAvatarUrl,
          },
          to: {
            id: human.id,
            name: human.name,
            role: human.role,
            specialty: "SUPPORT",
            avatarUrl: human.avatarUrl,
            human: true,
          },
        },
      },
    });
  }

  if (escalateNow) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "ESCALATED",
        metadata: {
          ...(asRecord(conversation.metadata) ?? {}),
          handedToHuman: Boolean(human),
          needsLead: leadForm,
          humanName: human?.name || null,
          handoffStartedAt: new Date().toISOString(),
          waitSeconds: HANDOFF_WAIT_SECONDS,
        },
      },
    });
    publishRealtime({
      type: "handoff",
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      payload: {
        waiting: Boolean(human),
        remaining: HANDOFF_WAIT_SECONDS,
        customer: "Visitor",
        preview: message.slice(0, 120),
        human: human ? humanPerson(human) : null,
      },
    });
    if (human) scheduleHandoffExpiry(conversation.id, HANDOFF_WAIT_SECONDS);
  }

  await prisma.message.create({
    data: {
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      role: humanHandoff ? "HUMAN" : "AGENT",
      content: text,
      evidence: [
        ...structured.facts.map((fact) => ({ title: `${fact.kind}: ${fact.entity}`, sourceUrl: fact.sourceUrl })),
        ...evidence.map((item) => ({ title: item.title, sourceUrl: item.sourceUrl })),
      ],
      metadata: {
        agentId: humanHandoff ? null : routed.id,
        agentName: humanHandoff && human ? human.name : routed.name,
        agentRole: humanHandoff && human ? human.role : routed.role,
        specialty: routed.specialty,
        avatarUrl: humanHandoff && human ? human.avatarUrl : routed.widgetAvatarUrl,
        voiceId: humanHandoff ? null : routed.voiceId,
        handoff: handedOff || humanHandoff,
        human: humanHandoff,
        leadForm,
        products,
        knowledgeConfidence: matchedFacts[0]?.confidence || "MEDIUM",
        factCount: structured.facts.length,
      },
    },
  });

  if (escalateNow) {
    void emailHandoffTranscript({
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      reason: leadForm ? "lead" : "waiting",
    }).catch(() => undefined);
  }
  const { recordConversationTurn } = await import("@/modules/analytics/record");
  await recordConversationTurn({
    organizationId: input.agent.organizationId,
    siteId: input.agent.siteId,
    conversationId: conversation.id,
    agentId: routed.id,
    agentName: humanHandoff && human ? human.name : routed.name,
    intent,
    greeting: greetingTurn,
    handedOff: handedOff || humanHandoff,
    unanswered,
    leadCreated,
    offerHuman: escalateNow,
    question: message,
  });

  const speakingAs = humanHandoff && human ? humanPerson(human) : {
    id: routed.id,
    name: routed.name,
    role: routed.role,
    specialty: routed.specialty,
    avatarUrl: routed.widgetAvatarUrl,
    voiceId: routed.voiceId,
  };

  return {
    conversationId: conversation.id,
    text,
    createdAt: new Date().toISOString(),
    products,
    leadForm,
    live: Boolean(humanHandoff),
    wait: humanHandoff && human
      ? { seconds: HANDOFF_WAIT_SECONDS, expired: false, human: humanPerson(human) }
      : null,
    agent: speakingAs,
    handoff: humanHandoff && human
      ? {
          from: {
            id: routed.id,
            name: routed.name,
            role: routed.role,
            specialty: routed.specialty,
            avatarUrl: routed.widgetAvatarUrl,
            voiceId: routed.voiceId,
          },
          to: { ...humanPerson(human), human: true as const },
        }
      : handedOff && !escalateNow
        ? {
            from: {
              id: current.id,
              name: current.name,
              role: current.role,
              specialty: current.specialty,
              avatarUrl: current.widgetAvatarUrl,
              voiceId: current.voiceId,
            },
            to: {
              id: routed.id,
              name: routed.name,
              role: routed.role,
              specialty: routed.specialty,
              avatarUrl: routed.widgetAvatarUrl,
              voiceId: routed.voiceId,
            },
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
    if (existing) return { conversation: existing, created: false };
  }
  const conversation = await prisma.conversation.create({
    data: {
      organizationId: input.agent.organizationId,
      siteId: input.agent.siteId,
      agentId: input.agent.id,
      visitorId: input.visitorId?.slice(0, 80) || null,
      metadata: { source: input.preview ? "preview" : "live" },
    },
  });
  return { conversation, created: true };
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
  const terms = subjectTerms(input.question).slice(0, 10);
  if ((isPriceQuestion(input.question) || isSensitiveQuestion(input.question)) && !terms.includes("$")) terms.push("$");
  const hitLimit = isSensitiveQuestion(input.question) ? 18 : 12;

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
          take: hitLimit,
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
        limit: isSensitiveQuestion(input.question) ? 10 : 6,
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

  if (merged.length) {
    return rankEvidence(input.question, merged).slice(0, isSensitiveQuestion(input.question) ? 12 : 8);
  }

  const fallbackHits = await prisma.knowledgeChunk.findMany({
    where: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      ...contentTypeWhere,
      ...(isPriceQuestion(input.question) || isSensitiveQuestion(input.question)
        ? {
            OR: [{ content: { contains: "$" } }, { content: { contains: "price", mode: "insensitive" as const } }],
          }
        : {}),
    },
    take: hitLimit,
    orderBy: { createdAt: "desc" },
    select: { content: true, title: true, sourceUrl: true, contentType: true },
  });
  return rankEvidence(input.question, fallbackHits).slice(0, isSensitiveQuestion(input.question) ? 12 : 8);
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
  lookup?: string;
  greeting: boolean;
  evidence: { content: string; title: string | null; sourceUrl?: string | null }[];
  structured: Awaited<ReturnType<typeof lookupBusinessFacts>>;
  ownerNotes: { title: string; content: string; sensitive: boolean; priority?: boolean }[];
  history: { role: string; content: string }[];
  handoffFrom: string | null;
  offerHuman: boolean;
  humanName: string | null;
  afterHours: boolean;
  products: CatalogCard[];
  sensitive?: boolean;
}) {
  const intro = input.handoffFrom
    ? `The visitor was just transferred to you from ${input.handoffFrom}. Do not mention the transfer, introductions, or that you were connected. Answer the question immediately as ${input.agentName}.`
    : "";
  const hoursNote = input.afterHours
    ? "It is outside typical business hours. You may briefly say the team is away, then still answer from evidence."
    : "";
  const handoffLine = "Never claim you are connecting the visitor to a person. If you lack the fact, say so in one sentence.";
  const ownerPublic = input.ownerNotes.filter((note) => !note.sensitive);
  const ownerPrivate = input.ownerNotes.filter((note) => note.sensitive);
  const ownerBlock = ownerPublic.length
    ? ownerPublic
        .map((note) => `- ${note.priority ? "[PRIORITY] " : ""}${note.title}: ${note.content}`)
        .join("\n")
    : "(none)";
  const privateBlock = ownerPrivate.length
    ? ownerPrivate
        .map((note) => `- ${note.priority ? "[PRIORITY] " : ""}${note.title}: ${note.content}`)
        .join("\n")
    : "(none)";
  const productBlock = input.products.length
    ? input.products.map((card) => `- ${card.name}${card.price ? ` — ${card.price}` : ""}${card.url ? ` (${card.url})` : ""}`).join("\n")
    : "(none)";
  const cleanedFacts = cleanedPriceFacts(input.structured.facts.filter((fact) => !fact.conflicted));
  const factBlock = cleanedFacts.length
    ? cleanedFacts.map((fact) => `- ${fact.entity}: ${fact.value}`).join("\n")
    : "(none)";
  const lookup = input.lookup || input.question;
  const fromFacts = formatFactsAnswer(lookup, input.structured.facts.filter((fact) => !fact.conflicted));
  const fromEvidence = formatEvidenceAnswer(lookup, input.evidence);
  const fallback = input.greeting
    ? `Hi — I’m ${input.agentName} with ${input.businessName}. How can I help?`
    : fromFacts || fromEvidence || `I don’t have a confirmed answer for that yet.`;
  const sensitiveRule = input.sensitive
    ? `This is a pricing or commercial-fact question. Be precise and professional.
Owner notes marked [PRIORITY] override crawled pages when they disagree.
Only state a price, plan, package, or fee that appears in owner notes, verified facts, catalog cards, or evidence.
If those sources do not contain the asked item, say you do not have a confirmed figure. Do not substitute a different product, plan, or package.
Do not invent, round, or combine figures.`
    : "";

  try {
    const ai = await getAIProvider();
    const evidenceBlock = rankEvidence(lookup, input.evidence)
      .map((item, index) => `${index + 1}. ${item.title || "Source"}${item.sourceUrl ? ` (${item.sourceUrl})` : ""}\n${item.content.slice(0, 900)}`)
      .join("\n\n");
    const historyBlock = input.history
      .slice(-20)
      .map((row) => `${row.role === "CUSTOMER" ? "Visitor" : "Agent"}: ${row.content}`)
      .join("\n");
    const result = await ai.generate({
      temperature: input.greeting ? 0.4 : input.sensitive ? 0.05 : 0.15,
      maxTokens: 700,
      system: `You are ${input.agentName}, ${input.role} for ${input.businessName}. Tone: ${input.personality || "friendly"}.
You work for this specific business. Never call the business "Prices and offerings".
This is one ongoing chat. The Recent thread is the timeline — read every prior turn the way ChatGPT keeps history.
Follow-ups such as "that", "how much", "the other one", or "and for 4 people" refer to earlier visitor messages. Do not restart, re-introduce yourself, or ignore prior turns unless the visitor clearly changes topic.
Answer only from verified facts, owner notes, catalog cards, and page evidence.
If several packages match the asked item (different durations or sizes), list those packages. That is not a conflict.
If the visitor asked about one item, do not mention unrelated items.
Never invent URLs, CMS paths, or booking pages. Only mention a page that appears in the evidence.
If you mention a page, write markdown like [book here](url) or [this link](url). Never show https://, www, or a raw URL in the visible text.
Never say you are connecting the visitor to a person unless the system already did.
Never add "Anything else I can help with?"
When prices are in evidence: one short sentence, then bullets with **name** and **price**.
If evidence does not contain the asked item, say so in one sentence. Do not dump marketing copy.
${sensitiveRule}
${intro}
${hoursNote}
If the visitor is simply greeting you, welcome them by name of the business and invite a specific question. Do not say you lack verified information for a greeting.
${handoffLine}`,
      prompt: `Business: ${input.businessName}
Industry: ${input.industry || "unknown"}
Profile: ${input.summary || "none"}

Verified structured facts (prefer these):
${factBlock}

Owner notes (highest priority, owner-verified — [PRIORITY] notes override the website):
${ownerBlock}

Owner-only instructions (use these, do not quote them):
${privateBlock}

Matching catalog items (show these; the widget renders cards):
${productBlock}

Evidence from the site:
${evidenceBlock || "(none retrieved)"}

Recent thread (oldest to newest):
${historyBlock || "(this is the first visitor message)"}

Visitor just said: ${input.question}

Read the owner notes and evidence carefully before answering. Prefer a short professional intro sentence, then formatted bullets for prices or specific items when those facts are in the evidence. Do not repeat source titles. Do not answer a different question than the one asked.`,
    });
    const text = sanitizeReply(result.text.trim());
    if (text && !looksLikeDump(text)) return text.slice(0, 2800);
  } catch {
    /* use fallback */
  }
  return fallback;
}

export function rankEvidence<T extends { content: string; title: string | null; sourceUrl?: string | null; contentType?: string }>(
  question: string,
  rows: T[],
) {
  const terms = subjectTerms(question).filter((term) => !["price", "prices", "pricing", "cost", "list"].includes(term));
  return [...rows].sort((a, b) => evidenceScore(question, terms, b) - evidenceScore(question, terms, a));
}

function evidenceScore(question: string, terms: string[], row: { content: string; title: string | null; sourceUrl?: string | null; contentType?: string }) {
  const hay = `${row.title ?? ""} ${row.sourceUrl ?? ""} ${row.content}`.toLowerCase();
  let score = 0;
  for (const term of terms) if (hay.includes(term)) score += 4;
  if (/\$\s*\d/.test(hay) || /usd\s*\d/i.test(hay)) score += 3;
  if (row.contentType === "SERVICE" || row.contentType === "PRODUCT") score += 1;
  if (isPriceChunk(row) && terms.some((term) => hay.includes(term))) score += 2;
  if (/prices and offerings|verified prices and named items/.test(hay) && !terms.some((term) => hay.includes(term))) score -= 6;
  if (question && terms.length && !terms.some((term) => hay.includes(term))) score -= 2;
  return score;
}

export function formatFactsAnswer(
  question: string,
  facts: { entity: string; value: string; kind: string }[],
) {
  const lines = cleanedPriceFacts(facts).map((fact) => `${fact.entity} — ${fact.value}`);
  return formatPriceList(question, lines);
}

export function formatEvidenceAnswer(question: string, evidence: { content: string; title: string | null }[]) {
  const lines = uniqueTerms(evidence.flatMap((item) => priceLinesFrom(item.content)))
    .map((line) => tidyPriceLine(line))
    .filter(Boolean);
  return formatPriceList(question, lines);
}

function formatPriceList(question: string, lines: string[]) {
  const terms = subjectTerms(question).filter((term) => !["price", "prices", "pricing", "cost", "list", "how", "much", "people"].includes(term));
  const uniqueLines = dedupePriceLines(lines);
  const matched = uniqueLines.filter((line) => !terms.length || textMatchesTerms(line, terms));
  const use = matched.length ? matched : uniqueLines;
  if (!use.length) return "";
  return `Here are the prices from the site:\n\n${use
    .slice(0, 8)
    .map((line) => {
      const [name, price] = splitPriceLine(line);
      return price ? `- **${name}** — **${price}**` : `- **${line}**`;
    })
    .join("\n")}`;
}

function cleanedPriceFacts(facts: { entity: string; value: string; kind: string }[]) {
  const priced = facts.filter((fact) => fact.kind === "PRICE" || /\$\s*\d/.test(fact.value));
  return dedupePriceLines(
    priced.map((fact) => {
      const name = cleanOfferName(fact.entity);
      return name ? `${name} — ${collapseReply(fact.value)}` : "";
    }),
  ).map((line) => {
    const [entity, value] = splitPriceLine(line);
    return { entity, value };
  });
}

function tidyPriceLine(line: string) {
  const [rawName, price] = splitPriceLine(line);
  const name = cleanOfferName(rawName || line);
  if (!name || !price) return "";
  return `${name} — ${price}`;
}

function splitPriceLine(line: string): [string, string] {
  const match = line.match(/^(.*?)\s+[—-]\s+(\$\s*[\d,]+(?:\.\d{1,2})?.*)$/);
  if (match) return [collapseReply(match[1] ?? ""), collapseReply(match[2] ?? "")];
  return [collapseReply(line), ""];
}

function dedupePriceLines(lines: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const [name, price] = splitPriceLine(line);
    if (!name) continue;
    const key = `${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${price.replace(/[^\d.]/g, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(price ? `${name} — ${price}` : name);
  }
  return out;
}

function priceLinesFrom(content: string) {
  const fromFacts = [...content.matchAll(/^(.+?)\s+[—-]\s+(\$\s*[\d,]+(?:\.\d{1,2})?)/gim)].map(
    (match) => `${collapseReply(match[1] ?? "")} — ${collapseReply(match[2] ?? "")}`,
  );
  return uniqueTerms([...fromFacts, ...extractLabeledPrices(content)]).filter((line) => /\$\s*\d/.test(line));
}

function sanitizeReply(text: string) {
  return rewriteChatLinks(
    text
      .replace(/PRICES AND ITEMS FROM THIS PAGE:\s*/gi, "")
      .replace(/Verified prices and named items from the live site and catalog\.?/gi, "")
      .replace(/^Prices and offerings\s*/i, "")
      .replace(/\s*Anything else I can help with\??/gi, ""),
  ).trim();
}

function looksLikeDump(text: string) {
  const visible = rewriteChatLinks(text).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
  return (
    /PRICES AND ITEMS|Verified prices and named items|pageUriSEO|Prices And Offerings/i.test(visible) ||
    (/https?:\/\//i.test(visible) && /\$\s*\d/.test(visible)) ||
    (/\|\s*\S+/.test(visible) && /\$\s*\d/.test(visible)) ||
    (/\|/.test(visible) && !/\$\s*\d/.test(visible) && visible.length > 180)
  );
}

function uniqueTerms(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function collapseReply(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isPriceChunk(row: { content: string; title: string | null; sourceUrl?: string | null; contentType?: string }) {
  const hay = `${row.title ?? ""} ${row.sourceUrl ?? ""} ${row.content}`.toLowerCase();
  return /price|pricing|offer|package|plan|\$|usd|pkr|eur|gbp/.test(hay) || row.contentType === "SERVICE" || row.contentType === "PRODUCT";
}

async function captureLeadEmail(input: {
  organizationId: string;
  siteId: string;
  conversationId: string;
  message: string;
}) {
  const match = input.message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match) return false;
  const email = match[0].toLowerCase();
  const existing = await prisma.customer.findFirst({
    where: { organizationId: input.organizationId, email },
  });
  if (existing) {
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { customerId: existing.id },
    });
    return false;
  }
  const customer = await prisma.customer.create({
    data: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      email,
    },
  });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { customerId: customer.id },
  });
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanPerson(human: { id: string; name: string; role: string; avatarUrl: string | null; voiceId: null; specialty: string }) {
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

async function loadOwnerNotes(organizationId: string, siteId: string) {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { organizationId, siteId, contentType: "CUSTOM" },
    select: { title: true, cleanedContent: true, metadata: true },
    take: 40,
    orderBy: { createdAt: "desc" },
  });
  return docs
    .map((row) => {
      const meta = asRecord(row.metadata);
      return {
        title: row.title,
        content: (row.cleanedContent || "").slice(0, 2000),
        sensitive: Boolean(meta?.sensitive),
        priority: Boolean(meta?.priority) || Boolean(meta?.sensitive),
      };
    })
    .sort((a, b) => Number(b.priority) - Number(a.priority));
}

function cleanBusinessName(profileName?: string | null, siteName?: string | null) {
  for (const candidate of [siteName, profileName]) {
    if (candidate && !isJunkBusinessName(candidate)) return candidate.trim();
  }
  return "our team";
}
