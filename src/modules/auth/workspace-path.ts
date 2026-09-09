import { prisma } from "@/lib/prisma";
import { entitlementsForOrganization } from "@/modules/billing/service";

/** Shared post-login path for Wix, Webflow, and email sessions. */
export async function workspacePathForOrganization(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { onboardingStatus: true },
  });
  const entitlements = await entitlementsForOrganization(organizationId);
  if (!entitlements.isPaidSeat) return "/billing";
  // ACTIVE agent means setup already finished — do not bounce to onboarding after a re-scan.
  const agent = await prisma.agent.findFirst({
    where: { organizationId, isPrimary: true },
    select: { status: true },
  });
  if (organization?.onboardingStatus === "PUBLISHED" || agent?.status === "ACTIVE") return "/dashboard";
  return "/onboarding";
}
