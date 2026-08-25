import { NextResponse } from "next/server";
import type { PlanKey } from "@prisma/client";
import { getAppOrigin } from "@/lib/env";
import { getSession } from "@/lib/security/session";
import { syncShopifyBillingFromShop } from "@/modules/shopify/billing";
import { isShopifyPlatform, resolveSitePlatform } from "@/modules/platforms";

export const dynamic = "force-dynamic";

const PLANS: Record<string, Extract<PlanKey, "STARTER" | "GROWTH" | "PRO">> = {
  STARTER: "STARTER",
  BUSINESS: "GROWTH",
  GROWTH: "GROWTH",
  PRO: "PRO",
};

/**
 * Return URL after the merchant approves (or declines) a Shopify app charge.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", getAppOrigin()));
  }
  if (!isShopifyPlatform(resolveSitePlatform(session.platform))) {
    return NextResponse.redirect(new URL("/billing", getAppOrigin()));
  }

  const planKey = PLANS[(url.searchParams.get("plan") ?? "").toUpperCase()] ?? null;
  const siteId = url.searchParams.get("siteId") || session.siteId;

  try {
    await syncShopifyBillingFromShop({
      organizationId: session.organizationId,
      siteId,
      preferredPlanKey: planKey,
    });
  } catch (error) {
    console.error("Shopify billing sync failed", error);
    return NextResponse.redirect(new URL("/billing?error=checkout", getAppOrigin()));
  }

  return NextResponse.redirect(new URL("/billing?checkout=success", getAppOrigin()));
}
