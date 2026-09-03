import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/security/settings";
import type { AppSession } from "@/lib/security/session";
import { seedDefaultAgent } from "@/modules/agents/defaults";
import { syntheticInstanceId } from "@/modules/platforms/types";
import { sitePublicUrl, type WebflowSiteRecord } from "@/modules/webflow/sites";

export type WebflowAuthorizedUser = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type TokenMetadata = Prisma.JsonObject & {
  provider: "webflow";
  accessToken: string;
  scope: string;
  webflowUserId: string | null;
  webflowSiteId: string;
};

export async function provisionTenantFromWebflow(input: {
  site: WebflowSiteRecord;
  user?: WebflowAuthorizedUser | null;
  accessToken: string;
  scope?: string;
}): Promise<AppSession> {
  const webflowSiteId = input.site.id;
  const instanceId = syntheticInstanceId("WEBFLOW", webflowSiteId);
  // Never persist Webflow screenshot previewUrl — only custom domain or *.webflow.io.
  const url = sitePublicUrl(input.site) ?? null;
  const displayName = input.site.displayName || input.site.shortName || url || "Webflow site";
  const ownerEmail = input.user?.email?.trim().toLowerCase() || undefined;
  const ownerName =
    [input.user?.firstName, input.user?.lastName].filter(Boolean).join(" ").trim() || displayName;
  const webflowUserId = input.user?.id ? `wf:${input.user.id}` : `wf:site:${webflowSiteId}`;

  const user = await findOrCreateWebflowUser({
    webflowUserId,
    email: ownerEmail,
    name: ownerName,
  });

  const tokenMetadata = {
    provider: "webflow",
    accessToken: encryptSecret(input.accessToken),
    scope: input.scope ?? "",
    webflowUserId: input.user?.id ?? null,
    webflowSiteId,
  } satisfies TokenMetadata;

  const existingSite = await prisma.wixSite.findUnique({
    where: { webflowSiteId },
    include: { organization: true, credential: true },
  });

  if (existingSite) {
    return connectExistingWebflowSite({
      existingSite,
      displayName,
      url,
      ownerEmail,
      instanceId,
      tokenMetadata,
      user,
    });
  }

  try {
    return await createWebflowTenant({
      webflowSiteId,
      instanceId,
      displayName,
      url,
      ownerEmail,
      user,
      tokenMetadata,
    });
  } catch (error) {
    const raced = await prisma.wixSite.findUnique({
      where: { webflowSiteId },
      include: { organization: true, credential: true },
    });
    if (!raced) throw error;
    return connectExistingWebflowSite({
      existingSite: raced,
      displayName,
      url,
      ownerEmail,
      instanceId,
      tokenMetadata,
      user,
    });
  }
}

async function connectExistingWebflowSite(input: {
  existingSite: {
    id: string;
    organizationId: string;
    wixInstanceId: string;
  };
  displayName: string;
  url: string | null;
  ownerEmail?: string;
  instanceId: string;
  tokenMetadata: TokenMetadata;
  user: { id: string; wixUserId: string | null };
}): Promise<AppSession> {
  const { existingSite } = input;
  await prisma.wixSite.update({
    where: { id: existingSite.id },
    data: {
      displayName: input.displayName,
      url: input.url,
      ownerEmail: input.ownerEmail,
      connectionStatus: "connected",
      lastSyncedAt: new Date(),
      platform: "WEBFLOW",
    },
  });

  await prisma.wixCredential.upsert({
    where: { siteId: existingSite.id },
    update: { instanceId: input.instanceId, metadata: input.tokenMetadata },
    create: {
      organizationId: existingSite.organizationId,
      siteId: existingSite.id,
      instanceId: input.instanceId,
      metadata: input.tokenMetadata,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: existingSite.organizationId,
        userId: input.user.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      organizationId: existingSite.organizationId,
      userId: input.user.id,
      role: "OWNER",
    },
  });

  return {
    userId: input.user.id,
    organizationId: existingSite.organizationId,
    siteId: existingSite.id,
    wixInstanceId: existingSite.wixInstanceId,
    wixUserId: input.user.wixUserId ?? undefined,
    platform: "WEBFLOW",
    role: "OWNER",
    email: input.ownerEmail,
    name: input.displayName,
  };
}

async function createWebflowTenant(input: {
  webflowSiteId: string;
  instanceId: string;
  displayName: string;
  url: string | null;
  ownerEmail?: string;
  user: { id: string; wixUserId: string | null };
  tokenMetadata: TokenMetadata;
}): Promise<AppSession> {
  const organization = await prisma.organization.create({
    data: {
      name: input.displayName,
      onboardingStatus: "SITE_CONNECTED",
    },
  });

  const plan = await prisma.plan.findUniqueOrThrow({ where: { key: "FREE" } });
  const site = await prisma.wixSite.create({
    data: {
      organizationId: organization.id,
      platform: "WEBFLOW",
      wixInstanceId: input.instanceId,
      webflowSiteId: input.webflowSiteId,
      displayName: input.displayName,
      url: input.url,
      ownerEmail: input.ownerEmail,
      connectionStatus: "connected",
      lastSyncedAt: new Date(),
      capabilities: { hasStores: false, source: "webflow" } as Prisma.InputJsonValue,
      credential: {
        create: {
          organizationId: organization.id,
          instanceId: input.instanceId,
          metadata: input.tokenMetadata,
        },
      },
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: input.user.id,
      role: "OWNER",
    },
  });

  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      planId: plan.id,
      planKey: "FREE",
      status: "NONE",
      isFree: true,
      billingProvider: "STRIPE",
    },
  });

  await prisma.businessProfile.create({
    data: {
      organizationId: organization.id,
      siteId: site.id,
      name: input.displayName,
    },
  });

  await seedDefaultAgent({
    organizationId: organization.id,
    siteId: site.id,
    name: "Sarah",
    storesEnabled: false,
  });

  return {
    userId: input.user.id,
    organizationId: organization.id,
    siteId: site.id,
    wixInstanceId: input.instanceId,
    wixUserId: input.user.wixUserId ?? undefined,
    platform: "WEBFLOW",
    role: "OWNER",
    email: input.ownerEmail,
    name: input.displayName,
  };
}

async function findOrCreateWebflowUser(input: {
  webflowUserId: string;
  email?: string;
  name: string;
}) {
  const byUid = await prisma.user.findUnique({ where: { wixUserId: input.webflowUserId } });
  if (byUid) {
    return prisma.user.update({
      where: { id: byUid.id },
      data: {
        email: input.email ?? byUid.email,
        name: input.name || byUid.name,
      },
    });
  }

  if (input.email) {
    const byEmail = await prisma.user.findFirst({ where: { email: input.email } });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { name: byEmail.name || input.name },
      });
    }
  }

  return prisma.user.create({
    data: {
      wixUserId: input.webflowUserId,
      email: input.email,
      name: input.name,
    },
  });
}
