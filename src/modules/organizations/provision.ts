import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { detectWixCapabilities } from "@/modules/wix/capabilities";
import { mapWixPackageToPlan } from "@/modules/billing/entitlements";
import { seedDefaultAgent } from "@/modules/agents/defaults";
import type { WixInstancePayload } from "@/lib/security/instance";
import type { WixSiteSnapshot } from "@/services/wix/client";
import type { AppSession } from "@/lib/security/session";

type ProvisionInput = {
  instance: WixInstancePayload;
  snapshot?: WixSiteSnapshot | null;
};

export async function provisionTenantFromWix(input: ProvisionInput): Promise<AppSession> {
  const instanceId = input.instance.instanceId;
  const snapshot = input.snapshot;
  const installedApps = snapshot?.site.installedWixApps ?? [];
  const capabilities = detectWixCapabilities(installedApps);
  const planKey = snapshot?.isFree
    ? "FREE"
    : mapWixPackageToPlan(snapshot?.billing?.packageName ?? input.instance.vendorProductId);
  const status = snapshot?.isFree
    ? "NONE"
    : snapshot?.billing?.freeTrialStatus === "IN_PROGRESS"
      ? "TRIALING"
      : "ACTIVE";

  const displayName =
    snapshot?.site.displayName ||
    snapshot?.site.url ||
    "Wix site";

  const existingSite = await prisma.wixSite.findUnique({
    where: { wixInstanceId: instanceId },
    include: { organization: true },
  });

  const user = await prisma.user.upsert({
    where: { wixUserId: input.instance.uid ?? `instance:${instanceId}` },
    update: {
      email: snapshot?.site.ownerEmail,
      name: snapshot?.site.displayName,
    },
    create: {
      wixUserId: input.instance.uid ?? `instance:${instanceId}`,
      email: snapshot?.site.ownerEmail,
      name: snapshot?.site.displayName ?? "Site owner",
    },
  });

  let organizationId = existingSite?.organizationId;
  let siteId = existingSite?.id;

  if (!existingSite) {
    const organization = await prisma.organization.create({
      data: {
        name: displayName,
        onboardingStatus: "SITE_CONNECTED",
      },
    });
    organizationId = organization.id;

    const site = await prisma.wixSite.create({
      data: {
        organizationId,
        wixInstanceId: instanceId,
        wixSiteId: snapshot?.site.siteId,
        displayName,
        url: snapshot?.site.url,
        locale: snapshot?.site.locale,
        currency: snapshot?.site.currency,
        ownerEmail: snapshot?.site.ownerEmail,
        originInstanceId: snapshot?.originInstanceId ?? input.instance.originInstanceId,
        installedWixApps: installedApps as Prisma.JsonArray,
        capabilities: capabilities as unknown as Prisma.InputJsonValue,
        connectionStatus: "connected",
        lastSyncedAt: new Date(),
        credential: {
          create: {
            organizationId,
            instanceId,
          },
        },
      },
    });
    siteId = site.id;

    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role: "OWNER",
      },
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { key: planKey } });
    await prisma.subscription.create({
      data: {
        organizationId,
        planId: plan.id,
        planKey,
        status,
        isFree: snapshot?.isFree ?? true,
        vendorProductId: snapshot?.billing?.packageName ?? input.instance.vendorProductId,
        billingCycle: snapshot?.billing?.billingCycle,
        trialEndsAt: snapshot?.billing?.freeTrialEndDate
          ? new Date(snapshot.billing.freeTrialEndDate)
          : null,
        currentPeriodEnd: snapshot?.billing?.expirationDate
          ? new Date(snapshot.billing.expirationDate)
          : null,
        autoRenewing: snapshot?.billing?.autoRenewing ?? false,
        rawBilling: snapshot?.billing as Prisma.InputJsonValue,
      },
    });

    await prisma.businessProfile.create({
      data: {
        organizationId,
        siteId,
        name: displayName,
        summary: snapshot?.site.description,
        capabilities: capabilities as unknown as Prisma.InputJsonValue,
      },
    });

    await seedDefaultAgent({
      organizationId,
      siteId,
      name: "Sarah",
      storesEnabled: capabilities.hasStores,
    });
  } else {
    await prisma.wixSite.update({
      where: { id: existingSite.id },
      data: {
        displayName,
        url: snapshot?.site.url,
        locale: snapshot?.site.locale,
        currency: snapshot?.site.currency,
        ownerEmail: snapshot?.site.ownerEmail,
        installedWixApps: installedApps as Prisma.JsonArray,
        capabilities: capabilities as unknown as Prisma.InputJsonValue,
        connectionStatus: "connected",
        lastSyncedAt: new Date(),
      },
    });

    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: existingSite.organizationId,
          userId: user.id,
        },
      },
      update: { role: "OWNER" },
      create: {
        organizationId: existingSite.organizationId,
        userId: user.id,
        role: "OWNER",
      },
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { key: planKey } });
    await prisma.subscription.updateMany({
      where: { organizationId: existingSite.organizationId },
      data: {
        planId: plan.id,
        planKey,
        status,
        isFree: snapshot?.isFree ?? true,
        vendorProductId: snapshot?.billing?.packageName ?? input.instance.vendorProductId,
        rawBilling: snapshot?.billing as Prisma.InputJsonValue,
      },
    });
  }

  if (!organizationId || !siteId) {
    throw new Error("Failed to provision tenant");
  }

  const { embedSiteWidget } = await import("@/modules/wix/embed");
  await embedSiteWidget(instanceId, false);

  return {
    userId: user.id,
    organizationId,
    siteId,
    wixInstanceId: instanceId,
    wixUserId: input.instance.uid,
    role: "OWNER",
    email: snapshot?.site.ownerEmail,
    name: displayName,
  };
}
