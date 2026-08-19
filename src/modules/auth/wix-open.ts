import { getEnv } from "@/lib/env";
import { parseWixInstance, assertNotAnonymousDashboardAccess } from "@/lib/security/instance";
import type { AppSession } from "@/lib/security/session";
import { fetchWixAppInstance } from "@/services/wix/client";
import { provisionTenantFromWix } from "@/modules/organizations/provision";
import { prisma } from "@/lib/prisma";
import { entitlementsForOrganization } from "@/modules/billing/service";

export async function completeWixLogin(instance: string): Promise<{
  session: AppSession;
  destination: string;
}> {
  const env = getEnv();
  const parsed = parseWixInstance(instance, env.WIX_APP_SECRET);
  if (!parsed) {
    throw new Error("Invalid Wix instance signature");
  }
  assertNotAnonymousDashboardAccess(parsed);

  let snapshot = null;
  try {
    snapshot = await fetchWixAppInstance(parsed.instanceId);
  } catch {
    snapshot = null;
  }

  const session = await provisionTenantFromWix({ instance: parsed, snapshot });

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
  });
  const entitlements = await entitlementsForOrganization(session.organizationId);

  return {
    session,
    destination: !entitlements.isPaidSeat
      ? "/billing"
      : organization.onboardingStatus === "PUBLISHED"
        ? "/dashboard"
        : "/onboarding",
  };
}
