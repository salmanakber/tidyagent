import { prisma } from "@/lib/prisma";
import { entitlementsForOrganization } from "@/modules/billing/service";
import {
  EntitlementDeniedError,
  UsageLimitError,
  type Entitlements,
} from "@/modules/billing/entitlements";
import type { AppSession } from "@/lib/security/session";

export async function requireTenantEntitlements(session: AppSession): Promise<Entitlements> {
  const entitlements = await entitlementsForOrganization(session.organizationId);
  if (!entitlements.isUsable) {
    throw new EntitlementDeniedError("isUsable");
  }
  return entitlements;
}

export async function requirePaidFeature(
  session: AppSession,
  feature: "voiceEnabled" | "advancedToolsEnabled" | "automationEnabled",
) {
  const entitlements = await requireTenantEntitlements(session);
  if (!entitlements[feature]) {
    throw new EntitlementDeniedError(feature);
  }
  return entitlements;
}

export async function requireKnowledgeCapacity(session: AppSession) {
  const entitlements = await requireTenantEntitlements(session);
  const count = await prisma.knowledgeDocument.count({
    where: { organizationId: session.organizationId },
  });
  if (count >= entitlements.knowledgeLimit) {
    throw new UsageLimitError("knowledge");
  }
  return entitlements;
}

export { EntitlementDeniedError, UsageLimitError };
