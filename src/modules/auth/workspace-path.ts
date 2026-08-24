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
  if (organization?.onboardingStatus !== "PUBLISHED") return "/onboarding";
  return "/dashboard";
}
