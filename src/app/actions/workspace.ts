"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/modules/organizations/workspace";
import { requireKnowledgeCapacity, requirePaidSeat } from "@/modules/billing/guard";

const agentUpdateSchema = z.object({
  agentId: z.string().optional(),
  name: z.string().min(1).max(60).optional(),
  role: z.string().min(1).max(80).optional(),
  personality: z.enum(["friendly", "professional", "casual", "custom"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  widgetPrimaryColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  widgetUseGradient: z.boolean().optional(),
  widgetGradientTo: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  widgetGradientAngle: z.enum(["to-bottom-right", "to-bottom-left", "to-right", "to-bottom", "radial"]).optional(),
  widgetTextColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  widgetMessageColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  widgetGreeting: z.string().min(1).max(160).optional(),
  widgetPosition: z.enum(["BOTTOM_RIGHT", "BOTTOM_LEFT"]).optional(),
  widgetEmbedMode: z.enum(["AUTO", "MANUAL"]).optional(),
  widgetTemplate: z.enum(["CLASSIC", "SOFT", "BAR", "MINIMAL"]).optional(),
  widgetAvatarUrl: z.union([z.string().url(), z.literal("")]).optional(),
  voiceEnabled: z.boolean().optional(),
  voiceId: z.string().min(3).max(80).optional(),
  specialty: z.enum(["GENERAL", "ECOMMERCE", "SUPPORT", "BOOKINGS", "CONTENT"]).optional(),
  knowledgeScopes: z.array(z.enum(["PAGE", "PRODUCT", "FAQ", "POLICY", "CUSTOM", "SERVICE"])).optional(),
  focus: z.array(z.string()).optional(),
});

export async function updateAgent(input: z.infer<typeof agentUpdateSchema>) {
  const session = await requireSession();
  const entitlements = await requirePaidSeat(session);
  const data = agentUpdateSchema.parse(input);
  const workspace = await getWorkspace(session);
  const target =
    workspace.agents.find((agent) => agent.id === data.agentId) ?? workspace.agent;
  if (!target) {
    throw new Error("Agent not found");
  }
  const { widgetAvatarUrl, widgetEmbedMode, agentId: _id, voiceEnabled, voiceId, widgetTemplate, ...rest } = data;
  const voiceAllowed = entitlements.voiceEnabled;
  const templateAllowed = entitlements.allTemplates || !widgetTemplate || widgetTemplate === "CLASSIC";
  await prisma.agent.update({
    where: {
      id: target.id,
      organizationId: session.organizationId,
    },
    data: {
      ...rest,
      ...(widgetEmbedMode !== undefined ? { widgetEmbedMode } : {}),
      ...(widgetAvatarUrl !== undefined ? { widgetAvatarUrl: widgetAvatarUrl || null } : {}),
      ...(widgetTemplate !== undefined && templateAllowed ? { widgetTemplate } : {}),
      ...(voiceEnabled !== undefined ? { voiceEnabled: voiceAllowed ? voiceEnabled : false } : {}),
      ...(voiceId !== undefined && voiceAllowed ? { voiceId } : {}),
    },
  });

  if (widgetEmbedMode) {
    const { embedWidgetForSession } = await import("@/modules/platforms");
    await embedWidgetForSession(session, widgetEmbedMode === "MANUAL");
  }

  revalidatePath("/agent");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function createSpecialistAgent(input: {
  name: string;
  specialty: "ECOMMERCE" | "SUPPORT" | "BOOKINGS" | "CONTENT";
  knowledgeScopes?: ("PAGE" | "PRODUCT" | "FAQ" | "POLICY" | "CUSTOM" | "SERVICE")[];
}) {
  const session = await requireSession();
  const entitlements = await requirePaidSeat(session);
  const { scopesForSpecialty } = await import("@/modules/agents/team");
  const { siteFactsFromApps } = await import("@/modules/knowledge/site-facts");
  const workspace = await getWorkspace(session);
  const limit = entitlements.maxAgents;
  if (workspace.agents.length >= limit) {
    throw new Error(`This plan allows ${limit} agent${limit === 1 ? "" : "s"}.`);
  }
  const facts = siteFactsFromApps(workspace.site.installedWixApps);
  if (input.specialty === "ECOMMERCE" && !facts.hasStores) {
    throw new Error("This site does not have Wix Stores, so a store agent cannot be added.");
  }
  if (input.specialty === "BOOKINGS" && !facts.hasBookings) {
    throw new Error("This site does not have Wix Bookings, so a bookings agent cannot be added.");
  }
  const name = z.string().min(1).max(60).parse(input.name);
  const scopes = input.knowledgeScopes?.length
    ? input.knowledgeScopes.filter((scope) => facts.contentTypes.includes(scope))
    : scopesForSpecialty(input.specialty, facts.contentTypes);
  const { pickVoiceForAgent } = await import("@/modules/voice/voices");
  const voiceId = pickVoiceForAgent(
    input.specialty,
    workspace.agents.map((agent) => agent.voiceId),
  );

  await prisma.agent.create({
    data: {
      organizationId: session.organizationId,
      siteId: session.siteId,
      name,
      role:
        input.specialty === "ECOMMERCE"
          ? "Store specialist"
          : input.specialty === "BOOKINGS"
            ? "Bookings specialist"
            : input.specialty === "SUPPORT"
              ? "Support specialist"
              : "Content specialist",
      personality: workspace.agent?.personality ?? "friendly",
      status: workspace.agent?.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
      isPrimary: false,
      specialty: input.specialty,
      knowledgeScopes: scopes,
      widgetPrimaryColor: workspace.agent?.widgetPrimaryColor ?? "#1F3A5F",
      widgetUseGradient: workspace.agent?.widgetUseGradient ?? false,
      widgetGradientTo: workspace.agent?.widgetGradientTo ?? "#4F8CFF",
      widgetGradientAngle: workspace.agent?.widgetGradientAngle ?? "to-bottom-right",
      widgetTextColor: workspace.agent?.widgetTextColor ?? "#FFFFFF",
      widgetMessageColor: workspace.agent?.widgetMessageColor ?? "#1E293B",
      widgetGreeting: `Hi, I’m ${name}. I can help with this.`,
      widgetPosition: workspace.agent?.widgetPosition ?? "BOTTOM_RIGHT",
      widgetTemplate: workspace.agent?.widgetTemplate ?? "CLASSIC",
      voiceEnabled: workspace.agent?.voiceEnabled ?? false,
      voiceId,
    },
  });
  revalidatePath("/agent");
}

export async function deleteAgent(agentId: string) {
  const session = await requireSession();
  await requirePaidSeat(session);
  const workspace = await getWorkspace(session);
  const target = workspace.agents.find((agent) => agent.id === agentId);
  if (!target) throw new Error("Agent not found");
  if (target.isPrimary || workspace.agents.length === 1) {
    throw new Error("The general agent cannot be removed.");
  }
  await prisma.agent.delete({
    where: { id: target.id, organizationId: session.organizationId },
  });
  revalidatePath("/agent");
}

export async function toggleRule(ruleId: string, enabled: boolean) {
  const session = await requireSession();
  await prisma.agentRule.updateMany({
    where: { id: ruleId, organizationId: session.organizationId },
    data: { enabled },
  });
  revalidatePath("/rules");
}

export async function toggleCapability(capabilityId: string, enabled: boolean) {
  const session = await requireSession();
  await prisma.agentCapability.updateMany({
    where: { id: capabilityId, organizationId: session.organizationId },
    data: { enabled },
  });
  revalidatePath("/agent");
}

export async function addCustomKnowledge(
  title: string,
  content: string,
  options?: { priority?: boolean; sensitive?: boolean },
) {
  const session = await requireSession();
  await requireKnowledgeCapacity(session);
  const titleSafe = z.string().min(2).max(120).parse(title);
  const contentSafe = z.string().min(2).max(8000).parse(content);
  const priority = Boolean(options?.priority);
  const sensitive = Boolean(options?.sensitive);

  const document = await prisma.knowledgeDocument.create({
    data: {
      organizationId: session.organizationId,
      siteId: session.siteId,
      title: titleSafe,
      contentType: "CUSTOM",
      cleanedContent: contentSafe,
      metadata: { origin: "owner", priority, sensitive },
    },
  });

  await prisma.knowledgeChunk.create({
    data: {
      organizationId: session.organizationId,
      siteId: session.siteId,
      documentId: document.id,
      title: titleSafe,
      content: contentSafe,
      contentType: "CUSTOM",
      metadata: { origin: "owner", priority, sensitive },
    },
  });

  const { factsFromPage } = await import("@/modules/knowledge/structured");
  const extracted = factsFromPage({
    url: "custom://owner",
    title: titleSafe,
    description: "",
    headings: [titleSafe],
    text: contentSafe,
    emails: [],
    phones: [],
    links: [],
    contentType: "CUSTOM",
    jsonLd: [],
  }).map((fact) => ({
    ...fact,
    extractionMethod: "custom" as const,
    confidence: "HIGH" as const,
  }));
  if (extracted.length) {
    await prisma.knowledgeFact.createMany({
      data: extracted.map((fact) => ({
        organizationId: session.organizationId,
        siteId: session.siteId,
        documentId: document.id,
        kind: fact.kind,
        entity: fact.entity,
        entityKey: fact.entityKey,
        value: fact.value,
        sourceUrl: null,
        extractionMethod: "custom",
        confidence: "HIGH",
      })),
    });
  }

  revalidatePath("/knowledge");
  revalidatePath("/onboarding");
}

export async function saveHumanHandoff(input: {
  name: string;
  role?: string;
  avatarUrl?: string;
  email?: string;
  whatsapp?: string | null;
  whatsappCountry?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  await requirePaidSeat(session);
  const name = z.string().min(2).max(60).parse(input.name.trim());
  const role = z.string().max(80).optional().parse(input.role?.trim() || "Team");
  const avatarUrl = z.union([z.string().url(), z.literal("")]).optional().parse(input.avatarUrl || "");
  const rawEmail = (input.email || "").trim();
  const email = rawEmail && rawEmail.includes("@") && rawEmail.includes(".") ? rawEmail : "";
  const { optionalWhatsAppE164 } = await import("@/modules/support/phone");
  const whatsapp = optionalWhatsAppE164(input.whatsapp, input.whatsappCountry);
  if (!whatsapp.ok) return { ok: false, error: whatsapp.error };
  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      humanAgentName: name,
      humanAgentRole: role || "Team",
      humanAgentAvatarUrl: avatarUrl || null,
      humanAgentEmail: email || null,
      humanAgentWhatsapp: whatsapp.e164,
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/conversations");
  revalidatePath("/agent");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveSetupPeople(input: {
  agentName: string;
  humanName: string;
  humanRole?: string;
  humanEmail?: string;
  humanAvatarUrl?: string;
  humanWhatsapp?: string | null;
  humanWhatsappCountry?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  await requirePaidSeat(session);
  const agentName = z.string().min(1).max(60).parse(input.agentName.trim());
  const avatarUrl = input.humanAvatarUrl && /^https?:\/\//.test(input.humanAvatarUrl) ? input.humanAvatarUrl : null;
  const { optionalWhatsAppE164 } = await import("@/modules/support/phone");
  const whatsapp = optionalWhatsAppE164(input.humanWhatsapp, input.humanWhatsappCountry);
  if (!whatsapp.ok) return { ok: false, error: whatsapp.error };
  await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      humanAgentName: z.string().min(2).max(60).parse(input.humanName.trim()),
      humanAgentRole: (input.humanRole?.trim() || "Team").slice(0, 80),
      humanAgentEmail: input.humanEmail?.trim() || null,
      humanAgentAvatarUrl: avatarUrl,
      humanAgentWhatsapp: whatsapp.e164,
    },
  });
  const workspace = await getWorkspace(session);
  if (workspace.agent) {
    await prisma.agent.update({
      where: { id: workspace.agent.id, organizationId: session.organizationId },
      data: {
        name: agentName,
        widgetGreeting: workspace.agent.widgetGreeting.includes(workspace.agent.name)
          ? workspace.agent.widgetGreeting.replaceAll(workspace.agent.name, agentName)
          : `Hi! I’m ${agentName}. How can I help you today?`,
      },
    });
  }
  revalidatePath("/onboarding");
  revalidatePath("/agent");
  return { ok: true };
}

export async function resolveConversation(conversationId: string) {
  const session = await requireSession();
  await requirePaidSeat(session);
  const id = z.string().min(8).max(80).parse(conversationId);
  await prisma.conversation.updateMany({
    where: { id, organizationId: session.organizationId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  await prisma.humanEscalation.updateMany({
    where: { conversationId: id, organizationId: session.organizationId, status: "open" },
    data: { status: "resolved", resolvedAt: new Date() },
  });
  revalidatePath("/conversations");
  revalidatePath(`/conversations/${id}`);
  revalidatePath("/dashboard");
}

export async function resolveKnowledgeConflict(conflictId: string, value: string) {
  const session = await requireSession();
  await requirePaidSeat(session);
  const chosen = z.string().min(1).max(200).parse(value);
  const conflict = await prisma.knowledgeConflict.findFirst({
    where: { id: conflictId, organizationId: session.organizationId },
  });
  if (!conflict) throw new Error("Conflict not found");

  await prisma.knowledgeConflict.update({
    where: { id: conflict.id },
    data: { status: "RESOLVED", resolvedValue: chosen },
  });
  await prisma.knowledgeFact.deleteMany({
    where: {
      organizationId: session.organizationId,
      siteId: conflict.siteId,
      kind: conflict.kind,
      entityKey: conflict.entityKey,
      value: { not: chosen },
      extractionMethod: { not: "custom" },
    },
  });
  revalidatePath("/knowledge");
}

export async function runSiteScan(input?: { fullSite?: boolean }) {
  const session = await requireSession();
  await requirePaidSeat(session);
  const { scanOrganizationSite } = await import("@/modules/knowledge/scanner");
  const result = await scanOrganizationSite({
    organizationId: session.organizationId,
    siteId: session.siteId,
    wixInstanceId: session.wixInstanceId,
    fullSite: input?.fullSite !== false,
  });
  if (result.ok) {
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: { onboardingStatus: "ANALYZING" },
    });
  }
  revalidatePath("/onboarding");
  revalidatePath("/knowledge");
  revalidatePath("/dashboard");
  revalidatePath("/agent");
  return result;
}

export async function advanceOnboarding(status: "ANALYZING" | "QUESTIONS" | "CONFIGURED" | "TESTED" | "PUBLISHED") {
  const session = await requireSession();
  await requirePaidSeat(session);
  await prisma.organization.update({
    where: { id: session.organizationId },
    data: { onboardingStatus: status },
  });
  if (status === "PUBLISHED") {
    await prisma.agent.updateMany({
      where: { organizationId: session.organizationId, siteId: session.siteId },
      data: { status: "ACTIVE", publishedAt: new Date() },
    });
    const { embedWidgetForSession, reportWixSetupFinishedForSession } = await import("@/modules/platforms");
    await embedWidgetForSession(session, false);
    await reportWixSetupFinishedForSession(session);
  }
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}

export async function toggleWorkflow(key: string, enabled: boolean) {
  const session = await requireSession();
  const entitlements = await requirePaidSeat(session);
  const { AUTOMATION_CATALOG, automationAllowedForEntitlements } = await import("@/modules/automations/catalog");
  const item = AUTOMATION_CATALOG.find((row) => row.key === key);
  if (!item) throw new Error("Unknown automation.");
  if (!automationAllowedForEntitlements(entitlements, item.key)) {
    throw new Error("This automation is not included on the current plan.");
  }
  const workspace = await getWorkspace(session);
  const agent = workspace.agent;
  if (!agent) throw new Error("Agent not found");
  await prisma.agentWorkflow.upsert({
    where: { agentId_key: { agentId: agent.id, key: item.key } },
    update: { enabled },
    create: {
      organizationId: session.organizationId,
      agentId: agent.id,
      key: item.key,
      enabled,
    },
  });
  revalidatePath("/automations");
}

export async function ensureAgentWorkflows(agentId: string, organizationId: string) {
  const { AUTOMATION_CATALOG } = await import("@/modules/automations/catalog");
  await prisma.agentWorkflow.createMany({
    data: AUTOMATION_CATALOG.map((item) => ({
      organizationId,
      agentId,
      key: item.key,
      enabled: true,
    })),
    skipDuplicates: true,
  });
}
