import { prisma } from "@/lib/prisma";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { isShopifyPlatform, isWebflowPlatform } from "@/modules/platforms/types";

/** Shared post-login path for Wix, Webflow, and email sessions. */
export async function workspacePathForOrganization(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { onboardingStatus: true },
  });
  const site = await prisma.wixSite.findFirst({
    where: { organizationId },
    select: { platform: true },
    orderBy: { updatedAt: "desc" },
  });
  const entitlements = await entitlementsForOrganization(organizationId);

  // Shopify / Webflow first install: pick Free or paid before onboarding.
  if (
    (isShopifyPlatform(site?.platform) || isWebflowPlatform(site?.platform)) &&
    organization?.onboardingStatus === "SITE_CONNECTED"
  ) {
    return "/billing";
  }

  if (!entitlements.isPaidSeat) return "/billing";
  // ACTIVE agent means setup already finished — do not bounce to onboarding after a re-scan.
  const agent = await prisma.agent.findFirst({
    where: { organizationId, isPrimary: true },
    select: { status: true },
  });
  if (organization?.onboardingStatus === "PUBLISHED" || agent?.status === "ACTIVE") return "/dashboard";
  return "/onboarding";
}
