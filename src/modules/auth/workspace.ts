import { prisma } from "@/lib/prisma";
import { seedDefaultAgent } from "@/modules/agents/defaults";
import { setSessionCookie, type AppSession } from "@/lib/security/session";
import type { User } from "@prisma/client";

export async function sessionForUser(user: User): Promise<AppSession> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: { include: { sites: { take: 1, orderBy: { createdAt: "asc" } } } } },
  });

  if (membership?.organization.sites[0]) {
    const site = membership.organization.sites[0];
    return {
      userId: user.id,
      organizationId: membership.organizationId,
      siteId: site.id,
      wixInstanceId: site.wixInstanceId,
      role: membership.role,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
    };
  }

  const organization = await prisma.organization.create({
    data: {
      name: user.name ? `${user.name}'s workspace` : "My workspace",
      onboardingStatus: "INSTALLED",
    },
  });

  const site = await prisma.wixSite.create({
    data: {
      organizationId: organization.id,
      wixInstanceId: `pending:${user.id}`,
      displayName: organization.name,
      ownerEmail: user.email,
      connectionStatus: "pending",
    },
  });

  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
  });

  const free = await prisma.plan.upsert({
    where: { key: "FREE" },
    update: {},
    create: {
      key: "FREE",
      name: "Free",
      conversationLimit: 100,
      knowledgeLimit: 50,
      voiceEnabled: false,
      advancedToolsEnabled: false,
      automationEnabled: false,
    },
  });
  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      planId: free.id,
      planKey: "FREE",
      status: "NONE",
      isFree: true,
    },
  });

  await seedDefaultAgent({
    organizationId: organization.id,
    siteId: site.id,
    name: "Sarah",
    storesEnabled: false,
  });

  return {
    userId: user.id,
    organizationId: organization.id,
    siteId: site.id,
    wixInstanceId: site.wixInstanceId,
    role: "OWNER",
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  };
}

export async function signInUser(user: User) {
  await setSessionCookie(await sessionForUser(user));
}
