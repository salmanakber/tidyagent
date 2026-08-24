"use server";

import { redirect } from "next/navigation";
import { getEnv, isDevMode } from "@/lib/env";
import { setSessionCookie, clearSessionCookie } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { completeWixLogin } from "@/modules/auth/wix-open";

export async function openFromWix(instance: string) {
  const { session, destination } = await completeWixLogin(instance);
  await setSessionCookie(session);
  redirect(destination);
}

export async function enterDevWorkspace() {
  if (!isDevMode()) {
    throw new Error("Dev mode is disabled");
  }

  const site = await prisma.wixSite.findUnique({
    where: { wixInstanceId: "demo-instance-atelier-noir" },
    include: {
      organization: {
        include: { members: true },
      },
    },
  });

  if (!site || !site.organization.members[0]) {
    throw new Error("Demo tenant is not seeded. Run npm run db:seed.");
  }

  await setSessionCookie({
    userId: site.organization.members[0].userId,
    organizationId: site.organizationId,
    siteId: site.id,
    wixInstanceId: site.wixInstanceId,
    platform: site.platform,
    role: "OWNER",
    email: site.ownerEmail ?? undefined,
    name: site.displayName ?? "Demo owner",
  });

  redirect("/dashboard");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login?disconnected=1");
}
