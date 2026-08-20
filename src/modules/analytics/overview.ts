import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/modules/organizations/workspace";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { classifyVisitorIntent, INTENT_LABELS } from "@/modules/agents/team";
import { isCasualOpener } from "@/modules/conversations/reply";
import type { AppSession } from "@/lib/security/session";
import type { AgentSpecialty, KnowledgeContentType } from "@prisma/client";

export async function getDashboardOverview(session: AppSession) {
  const workspace = await getWorkspace(session);
  const { organization, site, profile, agent, agents } = workspace;
  const since = daysAgo(30);

  const [
    conversationCount,
    resolvedCount,
    escalationCount,
    leadCount,
    unanswered,
    knowledge,
    recentConversations,
    customerMessages,
    agentMessages,
  ] = await Promise.all([
    prisma.conversation.count({ where: { organizationId: session.organizationId } }),
    prisma.conversation.count({
      where: { organizationId: session.organizationId, status: "RESOLVED" },
    }),
    prisma.humanEscalation.count({ where: { organizationId: session.organizationId } }),
    prisma.customer.count({
      where: { organizationId: session.organizationId, email: { not: null } },
    }),
    prisma.improvementSuggestion.findMany({
      where: { organizationId: session.organizationId, status: "open" },
      orderBy: { occurrences: "desc" },
      take: 8,
    }),
    prisma.knowledgeDocument.groupBy({
      by: ["contentType"],
      where: { organizationId: session.organizationId },
      _count: { _all: true },
    }),
    prisma.conversation.findMany({
      where: { organizationId: session.organizationId, startedAt: { gte: since } },
      select: { startedAt: true, status: true, agentId: true },
    }),
    prisma.message.findMany({
      where: { organizationId: session.organizationId, role: "CUSTOMER", createdAt: { gte: since } },
      select: { content: true, createdAt: true },
      take: 2500,
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findMany({
      where: { organizationId: session.organizationId, role: "AGENT", createdAt: { gte: since } },
      select: { metadata: true },
      take: 2500,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const knowledgeByType = Object.fromEntries(
    knowledge.map((row) => [row.contentType, row._count._all]),
  ) as Partial<Record<KnowledgeContentType, number>>;

  const entitlements = await entitlementsForOrganization(session.organizationId);
  const knowledgeTotal = knowledge.reduce((sum, row) => sum + row._count._all, 0);
  const coverageSlots: KnowledgeContentType[] = entitlements.advancedToolsEnabled
    ? ["PAGE", "FAQ", "POLICY", "CUSTOM", "PRODUCT"]
    : ["PAGE", "FAQ", "POLICY", "CUSTOM"];
  const filled = coverageSlots.filter((slot) => (knowledgeByType[slot] ?? 0) > 0).length;
  const coverage = knowledgeTotal === 0 ? 0 : Math.round((filled / coverageSlots.length) * 100);

  const topics = topicBuckets(customerMessages.map((row) => row.content));
  const daily = dailySeries(recentConversations.map((row) => row.startedAt), 14);
  const byAgent = agentBuckets(agentMessages.map((row) => row.metadata), agents);

  const topQuestions = unanswered.length
    ? unanswered.map((item) => ({
        topic: item.topic,
        question: item.question,
        occurrences: item.occurrences,
      }))
    : topics.slice(0, 5).map((item) => ({
        topic: item.label,
        question: item.sample,
        occurrences: item.occurrences,
      }));

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      onboardingStatus: organization.onboardingStatus,
    },
    site: {
      id: site.id,
      displayName: site.displayName,
      url: site.url,
      locale: site.locale,
      currency: site.currency,
      connectionStatus: site.connectionStatus,
      lastSyncedAt: site.lastSyncedAt,
      capabilities: site.capabilities,
      installedWixApps: site.installedWixApps,
    },
    profile,
    agent: agent
      ? {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          personality: agent.personality,
          status: agent.status,
          widgetPrimaryColor: agent.widgetPrimaryColor,
          widgetAvatarUrl: agent.widgetAvatarUrl,
          widgetPosition: agent.widgetPosition,
          widgetGreeting: agent.widgetGreeting,
          widgetEmbedMode: agent.widgetEmbedMode,
          widgetTemplate: agent.widgetTemplate,
          voiceEnabled: agent.voiceEnabled,
          isPrimary: agent.isPrimary,
          specialty: agent.specialty,
          knowledgeScopes: agent.knowledgeScopes,
          capabilities: agent.capabilities,
          rules: agent.rules,
          toolPermissions: agent.toolPermissions,
        }
      : null,
    agents: agents.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      personality: row.personality,
      status: row.status,
      widgetPrimaryColor: row.widgetPrimaryColor,
      widgetAvatarUrl: row.widgetAvatarUrl,
      widgetPosition: row.widgetPosition,
      widgetGreeting: row.widgetGreeting,
      widgetEmbedMode: row.widgetEmbedMode,
      widgetTemplate: row.widgetTemplate,
      voiceEnabled: row.voiceEnabled,
      isPrimary: row.isPrimary,
      specialty: row.specialty,
      knowledgeScopes: row.knowledgeScopes,
      capabilities: row.capabilities,
    })),
    entitlements,
    metrics: {
      conversations: conversationCount,
      resolvedByAi: resolvedCount,
      humanEscalations: escalationCount,
      leads: leadCount,
      salesAssisted: topics.find((item) => item.key === "ECOMMERCE")?.occurrences ?? 0,
      unanswered: unanswered.reduce((sum, item) => sum + item.occurrences, 0),
      knowledgeCoverage: coverage,
      improvementSuggestions: unanswered.length,
      visitorMessages: customerMessages.length,
    },
    knowledge: {
      pages: knowledgeByType.PAGE ?? 0,
      products: knowledgeByType.PRODUCT ?? 0,
      faqs: knowledgeByType.FAQ ?? 0,
      policies: knowledgeByType.POLICY ?? 0,
      custom: knowledgeByType.CUSTOM ?? 0,
      lastSyncedAt: site.lastSyncedAt,
    },
    topQuestions,
    improvements: unanswered,
    charts: {
      topics,
      daily,
      byAgent,
    },
  };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function topicBuckets(questions: string[]) {
  const counts = new Map<AgentSpecialty, { occurrences: number; sample: string }>();
  for (const raw of questions) {
    if (isCasualOpener(raw)) continue;
    const key = classifyVisitorIntent(raw);
    const current = counts.get(key) ?? { occurrences: 0, sample: raw };
    current.occurrences += 1;
    if (!current.sample) current.sample = raw;
    counts.set(key, current);
  }
  return [...counts.entries()]
    .map(([key, value]) => ({
      key,
      label: INTENT_LABELS[key],
      occurrences: value.occurrences,
      sample: value.sample,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

function dailySeries(dates: Date[], days: number) {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    buckets.set(isoDay(day), 0);
  }
  for (const date of dates) {
    const key = isoDay(date);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, conversations]) => ({ date, conversations }));
}

function isoDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
}

function agentBuckets(metadata: unknown[], agents: { id: string; name: string }[]) {
  const counts = new Map<string, { name: string; replies: number }>();
  for (const agent of agents) {
    counts.set(agent.id, { name: agent.name, replies: 0 });
  }
  for (const raw of metadata) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as { kind?: string; agentId?: string; agentName?: string };
    if (row.kind === "handoff") continue;
    const id = typeof row.agentId === "string" ? row.agentId : "unknown";
    const name = typeof row.agentName === "string" ? row.agentName : "Assistant";
    const current = counts.get(id) ?? { name, replies: 0 };
    current.replies += 1;
    if (name) current.name = name;
    counts.set(id, current);
  }
  return [...counts.values()].filter((item) => item.replies > 0 || agents.length > 0).sort((a, b) => b.replies - a.replies);
}
