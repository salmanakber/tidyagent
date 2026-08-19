import { NextResponse } from "next/server";
import type { PlanKey } from "@prisma/client";
import { getAppOrigin, getEnv } from "@/lib/env";
import { parseWixInstance } from "@/lib/security/instance";
import { getSession } from "@/lib/security/session";
import { wixCheckoutUrl } from "@/modules/billing/checkout";

const PLANS: Record<string, PlanKey> = {
  STARTER: "STARTER",
  BUSINESS: "GROWTH",
  GROWTH: "GROWTH",
  PRO: "PRO",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const planKey = PLANS[(url.searchParams.get("plan") ?? "").toUpperCase()];
  if (!planKey) {
    return NextResponse.redirect(new URL("/pricing", getAppOrigin()));
  }

  const instanceId = await resolveInstanceId(url);
  if (!instanceId) {
    return NextResponse.redirect(new URL("/pricing?error=instance", getAppOrigin()));
  }

  const checkoutUrl = await wixCheckoutUrl({
    instanceId,
    planKey,
    cycle: url.searchParams.get("cycle") === "YEARLY" ? "YEARLY" : "MONTHLY",
  });

  if (!checkoutUrl) {
    return NextResponse.redirect(new URL("/pricing?error=checkout", getAppOrigin()));
  }

  return NextResponse.redirect(checkoutUrl);
}

async function resolveInstanceId(url: URL) {
  const instance = url.searchParams.get("instance");
  if (instance) {
    const parsed = parseWixInstance(instance, getEnv().WIX_APP_SECRET);
    return parsed?.instanceId ?? null;
  }

  const fromQuery = url.searchParams.get("appInstanceId") ?? url.searchParams.get("instanceId");
  if (fromQuery) return fromQuery;

  const session = await getSession();
  return session?.wixInstanceId ?? null;
}
