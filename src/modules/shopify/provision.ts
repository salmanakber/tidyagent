import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/security/settings";
import type { AppSession } from "@/lib/security/session";
import { seedDefaultAgent } from "@/modules/agents/defaults";
import { syntheticInstanceId } from "@/modules/platforms/types";
import type { ShopifyShopRecord } from "@/modules/shopify/client";
import { shopPublicUrl } from "@/modules/shopify/shop";

type TokenMetadata = Prisma.JsonObject & {
  provider: "shopify";
  accessToken: string;
  scope: string;
  shopifyShopDomain: string;
};

export async function provisionTenantFromShopify(input: {
  shop: string;
  shopRecord?: ShopifyShopRecord | null;
  accessToken: string;
  scope?: string;
}): Promise<AppSession> {
  const shopifyShopDomain = input.shop;
  const instanceId = syntheticInstanceId("SHOPIFY", shopifyShopDomain);
  const url = shopPublicUrl(
    shopifyShopDomain,
    input.shopRecord?.myshopify_domain,
    input.shopRecord?.domain,
  );
  const displayName = input.shopRecord?.name || shopifyShopDomain.replace(".myshopify.com", "");
  const ownerEmail = input.shopRecord?.email?.trim().toLowerCase() || undefined;
  const ownerName = input.shopRecord?.shop_owner?.trim() || displayName;
  const shopifyUserId = `shopify:shop:${shopifyShopDomain}`;

  const user = await findOrCreateShopifyUser({
    shopifyUserId,
    email: ownerEmail,
    name: ownerName,
  });

  const tokenMetadata = {
    provider: "shopify",
    accessToken: encryptSecret(input.accessToken),
    scope: input.scope ?? "",
    shopifyShopDomain,
  } satisfies TokenMetadata;

  const existingSite = await prisma.wixSite.findUnique({
    where: { shopifyShopDomain },
    include: { organization: true, credential: true },
  });

  if (existingSite) {
    return connectExistingShopifySite({
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
    return await createShopifyTenant({
      shopifyShopDomain,
      instanceId,
      displayName,
      url,
      ownerEmail,
      user,
      tokenMetadata,
    });
  } catch (error) {
    const raced = await prisma.wixSite.findUnique({
      where: { shopifyShopDomain },
      include: { organization: true, credential: true },
    });
    if (!raced) throw error;
    return connectExistingShopifySite({
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

async function connectExistingShopifySite(input: {
  existingSite: { id: string; organizationId: string; wixInstanceId: string };
  displayName: string;
  url?: string;
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
      platform: "SHOPIFY",
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
    platform: "SHOPIFY",
    role: "OWNER",
    email: input.ownerEmail,
    name: input.displayName,
  };
}

async function createShopifyTenant(input: {
  shopifyShopDomain: string;
  instanceId: string;
  displayName: string;
  url?: string;
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
      platform: "SHOPIFY",
      wixInstanceId: input.instanceId,
      shopifyShopDomain: input.shopifyShopDomain,
      displayName: input.displayName,
      url: input.url,
      ownerEmail: input.ownerEmail,
      connectionStatus: "connected",
      lastSyncedAt: new Date(),
      capabilities: { hasStores: true, source: "shopify" } as Prisma.InputJsonValue,
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
      billingProvider: "SHOPIFY",
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
    storesEnabled: true,
  });

  return {
    userId: input.user.id,
    organizationId: organization.id,
    siteId: site.id,
    wixInstanceId: input.instanceId,
    wixUserId: input.user.wixUserId ?? undefined,
    platform: "SHOPIFY",
    role: "OWNER",
    email: input.ownerEmail,
    name: input.displayName,
  };
}

async function findOrCreateShopifyUser(input: {
  shopifyUserId: string;
  email?: string;
  name: string;
}) {
  const byUid = await prisma.user.findUnique({ where: { wixUserId: input.shopifyUserId } });
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
      wixUserId: input.shopifyUserId,
      email: input.email,
      name: input.name,
    },
  });
}
