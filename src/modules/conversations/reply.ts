import type { AgentSpecialty, KnowledgeContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/modules/ai/factory";
import { retrieveKnowledgeChunks } from "@/modules/organizations/workspace";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { getPlanScope } from "@/modules/billing/plan-scope-store";
import { scanScopeFromConfig } from "@/modules/knowledge/scan-scope";
import { lookupBusinessFacts } from "@/modules/knowledge/lookup";
import { extractLabeledPrices } from "@/modules/knowledge/facts";
import { classifyVisitorIntent, pickAgentForIntent } from "@/modules/agents/team";
import { isWorkflowOn, type AutomationKey, automationAllowedForEntitlements } from "@/modules/automations/catalog";
import type { ResolvedWidgetAgent } from "@/modules/widget/resolve";
import { reportPrimaryAction } from "@/modules/wix/bi-events";

const OPENER =
  /^(hi+|hii+|hello|hey|hey there|hi there|good morning|good afternoon|good evening|howdy|yo|sup|what'?s up|how are you)\s*[!.?]*$/i;

export function isCasualOpener(text: string) {
  return OPENER.test(text.trim().replace(/[^\w\s'!?]/g, ""));
}

export function isPriceQuestion(text: string) {
  return /price|pricing|cost|how much|fee|rate|package|plan|charge|quote|\$/.test(text.toLowerCase());
}

export function subjectTerms(text: string) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "you",
    "can",
    "tell",
    "list",
    "have",
    "what",
    "with",
    "this",
    "that",
    "from",
    "your",
    "our",
    "are",
    "was",
    "please",
    "need",
    "book",
    "want",
    "check",
    "website",
    "site",
    "there",
    "here",
    "just",
  ]);
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s$-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stop.has(word));
  return uniqueTerms(raw);
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

  const { conversation, created } = await getOrCreateConversation(input);
  if (created && !input.preview) {
    reportPrimaryAction(input.agent.site.wixInstanceId);
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
  const greetingTurn = isCasualOpener(message) && on("greeting");
  const intent = greetingTurn ? "GENERAL" : classifyVisitorIntent(message);
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
  const businessName = profile?.name || input.agent.site.displayName || "our team";
  const planScope = await getPlanScope(entitlements.planKey);
  const scope = scanScopeFromConfig(entitlements.planKey, planScope);
  const assignedScopes = (routed.knowledgeScopes as KnowledgeContentType[]).filter((item) =>
    on("shopping") ? true : item !== "PRODUCT",
  );
  if (isPriceQuestion(message)) {
    if (!assignedScopes.includes("SERVICE")) assignedScopes.push("SERVICE");
    if (scope.includeStores && on("shopping") && !assignedScopes.includes("PRODUCT")) {
      assignedScopes.push("PRODUCT");
    }
  }
  const structured = greetingTurn
    ? { facts: [], conflicts: [] }
    : await lookupBusinessFacts({
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        question: message,
      });

  const evidence = greetingTurn
    ? []
    : await gatherEvidence({
        organizationId: input.agent.organizationId,
        siteId: input.agent.siteId,
        question: message,
        includeStores: scope.includeStores && on("shopping"),
        contentTypes: assignedScopes,
      });

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id, organizationId: input.agent.organizationId },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  const hour = new Date().getUTCHours();
  const afterHours = on("after_hours") && (hour >= 20 || hour < 8);

  let text = await generateReply({
    agentName: routed.name,
    role: routed.role,
    personality: routed.personality,
    specialty: routed.specialty,
    businessName,
    summary: profile?.summary || "",
    industry: profile?.industry || "",
    question: message,
    greeting: greetingTurn,
    evidence,
    structured,
    history: history
      .filter((row) => {
        const meta = row.metadata as { kind?: string } | null;
        return meta?.kind !== "handoff";
      })
      .map((row) => ({ role: row.role, content: row.content })),
    handoffFrom: handedOff ? current.name : null,
    offerHuman: on("human_handoff"),
    afterHours,
  });
  if (on("follow_up") && !greetingTurn && !/[?？]/.test(text) && !looksLikeDump(text) && text.length < 900) {
    text = `${text.replace(/\s+$/, "")} Anything else I can help with?`;
  }

  await prisma.message.create({
    data: {
      organizationId: input.agent.organizationId,
      conversationId: conversation.id,
      role: "AGENT",
      content: text,
      evidence: [
        ...structured.facts.map((fact) => ({ title: `${fact.kind}: ${fact.entity}`, sourceUrl: fact.sourceUrl })),
        ...evidence.map((item) => ({ title: item.title, sourceUrl: item.sourceUrl })),
      ],
      metadata: {
        agentId: routed.id,
        agentName: routed.name,
        agentRole: routed.role,
        specialty: routed.specialty,
        avatarUrl: routed.widgetAvatarUrl,
        voiceId: routed.voiceId,
        handoff: handedOff,
        knowledgeConfidence: structured.conflicts.length ? "LOW" : structured.facts[0]?.confidence || "MEDIUM",
        factCount: structured.facts.length,
      },
    },
  });

  const unanswered = !greetingTurn && evidence.length === 0;
  const { recordConversationTurn } = await import("@/modules/analytics/record");
  await recordConversationTurn({
    organizationId: input.agent.organizationId,
    siteId: input.agent.siteId,
    conversationId: conversation.id,
    agentId: routed.id,
    agentName: routed.name,
    intent,
    greeting: greetingTurn,
    handedOff,
    unanswered,
    leadCreated,
    offerHuman: on("human_handoff") && unanswered,
    question: message,
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
      voiceId: routed.voiceId,
    },
    handoff: handedOff
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
  if (isPriceQuestion(input.question) && !terms.includes("$")) terms.push("$");

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
          take: 12,
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

  if (merged.length) {
    return rankEvidence(input.question, merged).slice(0, 8);
  }

  const fallbackHits = await prisma.knowledgeChunk.findMany({
    where: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      ...contentTypeWhere,
      ...(isPriceQuestion(input.question)
        ? {
            OR: [{ content: { contains: "$" } }, { content: { contains: "price", mode: "insensitive" as const } }],
          }
        : {}),
    },
    take: 12,
    orderBy: { createdAt: "desc" },
    select: { content: true, title: true, sourceUrl: true, contentType: true },
  });
  return rankEvidence(input.question, fallbackHits).slice(0, 8);
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
  structured: Awaited<ReturnType<typeof lookupBusinessFacts>>;
  history: { role: string; content: string }[];
  handoffFrom: string | null;
  offerHuman: boolean;
  afterHours: boolean;
}) {
  const intro = input.handoffFrom
    ? `The visitor was just transferred to you from ${input.handoffFrom}. Do not mention the transfer, introductions, or that you were connected. Answer the question immediately as ${input.agentName}.`
    : "";
  const hoursNote = input.afterHours
    ? "It is outside typical business hours. You may briefly say the team is away, then still answer from evidence."
    : "";
  const handoffLine = input.offerHuman
    ? "If the question needs facts you do not have, say so plainly and offer a human handoff."
    : "If the question needs facts you do not have, say so plainly. Do not offer a human transfer.";
  const factBlock = input.structured.facts.length
    ? input.structured.facts
        .map((fact) => `- ${fact.kind} ${fact.entity} = ${fact.value}${fact.sourceUrl ? ` (${fact.sourceUrl})` : ""} [${fact.confidence}${fact.conflicted ? ", CONFLICT" : ""}]`)
        .join("\n")
    : "(none)";
  const conflictBlock = input.structured.conflicts.length
    ? input.structured.conflicts.map((row) => `- ${row.entity}: ${JSON.stringify(row.values)}`).join("\n")
    : "none";
  const fallback = input.greeting
    ? `Hi — I’m ${input.agentName} with ${input.businessName}. How can I help you today?`
    : input.structured.facts.filter((fact) => !fact.conflicted).length
      ? formatFactsAnswer(input.question, input.structured.facts.filter((fact) => !fact.conflicted))
      : input.structured.conflicts.length
        ? `I have more than one listed value for that, so I don’t want to guess. I can connect you with the team to confirm.`
        : input.evidence.length
          ? formatEvidenceAnswer(input.question, input.evidence)
          : `I don’t have that on file for ${input.businessName} yet.${input.offerHuman ? " I can connect you with the team to confirm." : ""}`;

  try {
    const ai = await getAIProvider();
    const evidenceBlock = rankEvidence(input.question, input.evidence)
      .map((item, index) => `${index + 1}. ${item.title || "Source"}${item.sourceUrl ? ` (${item.sourceUrl})` : ""}\n${item.content.slice(0, 900)}`)
      .join("\n\n");
    const historyBlock = input.history
      .slice(-8)
      .map((row) => `${row.role === "CUSTOMER" ? "Visitor" : "Agent"}: ${row.content}`)
      .join("\n");
    const result = await ai.generate({
      temperature: input.greeting ? 0.4 : 0.15,
      maxTokens: 700,
      system: `You are ${input.agentName}, ${input.role} for ${input.businessName}. Tone: ${input.personality || "friendly"}.
Specialty: ${input.specialty}. Stay inside that specialty and the evidence. If the question belongs to another team, say you are connecting them.
You are a real customer-service employee for this Wix business, not a generic chatbot.
Prefer verified structured facts over page text. If a fact is marked CONFLICT, do not pick a number — say the listed values disagree and offer a human.
Never invent prices, policies, hours, or products.
Answer the visitor's latest question only. If they asked about one service, product, or package, list only that. Do not mix in unrelated items or homepage marketing copy.
When evidence includes prices for the asked item, present them clearly:
- One short intro sentence.
- Each distinct item on its own bullet.
- Bold the item name and the exact price with **double asterisks**.
- If a source URL is in the evidence, add one markdown link: [View details](https://...).
Never paste page titles, meta descriptions, "Prices and offerings", "PRICES AND ITEMS FROM THIS PAGE", raw field names, or concatenated SEO text.
If the evidence does not contain the asked item's prices, say that plainly. Do not dump unrelated page text.
If the visitor misspells a product or service name, match it to the closest name in the verified facts or evidence.
${intro}
${hoursNote}
If the visitor is simply greeting you, welcome them by name of the business and invite a specific question. Do not say you lack verified information for a greeting.
${handoffLine}`,
      prompt: `Business: ${input.businessName}
Industry: ${input.industry || "unknown"}
Profile: ${input.summary || "none"}

Verified structured facts (prefer these):
${factBlock}

Open conflicts:
${conflictBlock}

Evidence from the site (this agent’s assigned data only):
${evidenceBlock || "(none retrieved)"}

Recent thread:
${historyBlock}

Visitor just said: ${input.question}

Answer the question. Prefer a short intro sentence, then formatted bullets for prices or specific items when those facts are in the evidence. Do not repeat source titles.`,
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
  const priced = facts.filter((fact) => fact.kind === "PRICE" || /\$\s*\d/.test(fact.value));
  const use = priced.length ? priced : facts;
  if (!use.length) return formatEvidenceAnswer(question, []);
  return `Here is what I have from the site:\n${use
    .slice(0, 8)
    .map((fact) => `- **${fact.entity}** — **${fact.value}**`)
    .join("\n")}`;
}

export function formatEvidenceAnswer(question: string, evidence: { content: string; title: string | null }[]) {
  const terms = subjectTerms(question).filter((term) => !["price", "prices", "pricing", "cost", "list"].includes(term));
  const lines = uniqueTerms(evidence.flatMap((item) => priceLinesFrom(item.content)));
  const matched = lines.filter((line) => !terms.length || terms.some((term) => line.toLowerCase().includes(term)));
  const use = matched.length ? matched : [];
  if (use.length) {
    const topic = terms[0] ? `${terms[0]} ` : "";
    return `Here are the ${topic}prices from the site:\n${use
      .slice(0, 8)
      .map((line) => {
        const [name, price] = line.split(/\s+[—-]\s+/);
        return price ? `- **${name.trim()}** — **${price.trim()}**` : `- **${line}**`;
      })
      .join("\n")}`;
  }
  if (!evidence.length) return "I don’t have that on file yet.";
  return "I don’t have a specific price list for that item in the site pages I can see. Ask me about a named service, product, or package, or I can connect you with the team.";
}

function priceLinesFrom(content: string) {
  const fromFacts = [...content.matchAll(/^(.+?)\s+[—-]\s+(\$\s*[\d,]+(?:\.\d{1,2})?)/gim)].map(
    (match) => `${collapseReply(match[1] ?? "")} — ${collapseReply(match[2] ?? "")}`,
  );
  return uniqueTerms([...fromFacts, ...extractLabeledPrices(content)]).filter((line) => /\$\s*\d/.test(line));
}

function sanitizeReply(text: string) {
  return text
    .replace(/PRICES AND ITEMS FROM THIS PAGE:\s*/gi, "")
    .replace(/Verified prices and named items from the live site and catalog\.?/gi, "")
    .replace(/^Prices and offerings\s*/i, "")
    .trim();
}

function looksLikeDump(text: string) {
  return /PRICES AND ITEMS|Verified prices and named items|pageUriSEO/i.test(text) || (/\|/.test(text) && !/\$\s*\d/.test(text) && text.length > 180);
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
