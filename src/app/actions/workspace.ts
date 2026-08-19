"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { getWorkspace } from "@/modules/organizations/workspace";
import { requireKnowledgeCapacity, requirePaidSeat } from "@/modules/billing/guard";

const agentUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  role: z.string().min(1).max(80).optional(),
  personality: z.enum(["friendly", "professional", "casual", "custom"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  widgetPrimaryColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  widgetGreeting: z.string().min(1).max(160).optional(),
  widgetPosition: z.enum(["BOTTOM_RIGHT", "BOTTOM_LEFT"]).optional(),
  widgetEmbedMode: z.enum(["AUTO", "MANUAL"]).optional(),
  widgetAvatarUrl: z.union([z.string().url(), z.literal("")]).optional(),
  focus: z.array(z.string()).optional(),
});

export async function updateAgent(input: z.infer<typeof agentUpdateSchema>) {
  const session = await requireSession();
  await requirePaidSeat(session);
  const data = agentUpdateSchema.parse(input);
  const workspace = await getWorkspace(session);
  if (!workspace.agent) {
    throw new Error("Agent not found");
  }

  const { widgetAvatarUrl, widgetEmbedMode, ...rest } = data;
  await prisma.agent.update({
    where: {
      id: workspace.agent.id,
      organizationId: session.organizationId,
    },
    data: {
      ...rest,
      ...(widgetEmbedMode !== undefined ? { widgetEmbedMode } : {}),
      ...(widgetAvatarUrl !== undefined ? { widgetAvatarUrl: widgetAvatarUrl || null } : {}),
    },
  });

  if (widgetEmbedMode) {
    const { embedSiteWidget } = await import("@/modules/wix/embed");
    await embedSiteWidget(session.wixInstanceId, widgetEmbedMode === "MANUAL");
  }

  revalidatePath("/agent");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
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

export async function addCustomKnowledge(title: string, content: string) {
  const session = await requireSession();
  await requireKnowledgeCapacity(session);
  const titleSafe = z.string().min(2).max(120).parse(title);
  const contentSafe = z.string().min(8).max(8000).parse(content);

  const document = await prisma.knowledgeDocument.create({
    data: {
      organizationId: session.organizationId,
      siteId: session.siteId,
      title: titleSafe,
      contentType: "CUSTOM",
      cleanedContent: contentSafe,
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
    },
  });

  revalidatePath("/knowledge");
}

export async function runSiteScan() {
  const session = await requireSession();
  await requirePaidSeat(session);
  const { scanOrganizationSite } = await import("@/modules/knowledge/scanner");
  const result = await scanOrganizationSite({
    organizationId: session.organizationId,
    siteId: session.siteId,
    wixInstanceId: session.wixInstanceId,
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
    const { embedSiteWidget } = await import("@/modules/wix/embed");
    await embedSiteWidget(session.wixInstanceId, false);
  }
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}
