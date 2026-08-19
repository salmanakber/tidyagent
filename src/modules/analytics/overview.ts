import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/modules/organizations/workspace";
import { resolveEntitlements } from "@/modules/billing/entitlements";
import type { AppSession } from "@/lib/security/session";
import type { KnowledgeContentType } from "@prisma/client";

export async function getDashboardOverview(session: AppSession) {
  const workspace = await getWorkspace(session);
  const { organization, site, subscription, profile, agent } = workspace;

  const [conversationCount, resolvedCount, escalationCount, leadCount, unanswered, knowledge] =
    await Promise.all([
      prisma.conversation.count({ where: { organizationId: session.organizationId } }),
      prisma.conversation.count({
        where: { organizationId: session.organizationId, status: "RESOLVED" },
      }),
      prisma.humanEscalation.count({ where: { organizationId: session.organizationId } }),
      prisma.analyticsEvent.count({
        where: { organizationId: session.organizationId, type: "lead_created" },
      }),
      prisma.improvementSuggestion.findMany({
        where: { organizationId: session.organizationId, status: "open" },
        orderBy: { occurrences: "desc" },
        take: 5,
      }),
      prisma.knowledgeDocument.groupBy({
        by: ["contentType"],
        where: { organizationId: session.organizationId },
        _count: { _all: true },
      }),
    ]);

  const knowledgeByType = Object.fromEntries(
    knowledge.map((row) => [row.contentType, row._count._all]),
  ) as Partial<Record<KnowledgeContentType, number>>;

  const entitlements = subscription
    ? resolveEntitlements({
        planKey: subscription.planKey,
        status: subscription.status,
        isFree: subscription.isFree,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        billingIssue: subscription.billingIssue,
        currentPeriodEnd: subscription.currentPeriodEnd,
        suspended: organization.accessStatus === "suspended",
      })
    : resolveEntitlements({
        planKey: "FREE",
        status: "NONE",
        isFree: true,
        suspended: organization.accessStatus === "suspended",
      });

  const knowledgeTotal = knowledge.reduce((sum, row) => sum + row._count._all, 0);
  const coverage =
    knowledgeTotal === 0 ? 0 : Math.min(100, Math.round((knowledgeTotal / Math.max(entitlements.knowledgeLimit, 1)) * 100 + 40));

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
          capabilities: agent.capabilities,
          rules: agent.rules,
          toolPermissions: agent.toolPermissions,
        }
      : null,
    entitlements,
    metrics: {
      conversations: conversationCount,
      resolvedByAi: resolvedCount,
      humanEscalations: escalationCount,
      leads: leadCount,
      salesAssisted: Math.max(0, resolvedCount - escalationCount),
      unanswered: unanswered.reduce((sum, item) => sum + item.occurrences, 0),
      knowledgeCoverage: coverage,
      improvementSuggestions: unanswered.length,
    },
    knowledge: {
      pages: knowledgeByType.PAGE ?? 0,
      products: knowledgeByType.PRODUCT ?? 0,
      faqs: knowledgeByType.FAQ ?? 0,
      policies: knowledgeByType.POLICY ?? 0,
      custom: knowledgeByType.CUSTOM ?? 0,
      lastSyncedAt: site.lastSyncedAt,
    },
    topQuestions: unanswered.map((item) => ({
      topic: item.topic,
      question: item.question,
      occurrences: item.occurrences,
    })),
    improvements: unanswered,
  };
}
