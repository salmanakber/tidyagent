"use server";

import { redirect } from "next/navigation";
import { isDevMode } from "@/lib/env";
import { setSessionCookie, clearSessionCookie, getSession } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { completeWixLogin } from "@/modules/auth/wix-open";
import { isWebflowPlatform } from "@/modules/platforms/types";
import { removeWebflowWidgetForSite } from "@/modules/webflow/embed";

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

/** Clears session. For Webflow, removes tidyAgent Custom Code first while the token is valid. */
export async function logout() {
  const session = await getSession();
  if (session && isWebflowPlatform(session.platform)) {
    await removeWebflowWidgetForSite(session.siteId).catch((error) => {
      console.error("Webflow widget cleanup on disconnect failed", error);
    });
  }
  await clearSessionCookie();
  redirect("/login?disconnected=1");
}
