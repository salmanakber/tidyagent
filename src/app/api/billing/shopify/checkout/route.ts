import { NextResponse } from "next/server";
import type { PlanKey } from "@prisma/client";
import { getAppOrigin } from "@/lib/env";
import { getSession } from "@/lib/security/session";
import { createShopifyBillingConfirmation } from "@/modules/shopify/billing";
import { isShopifyPlatform, resolveSitePlatform } from "@/modules/platforms";

export const dynamic = "force-dynamic";

const PLANS: Record<string, Extract<PlanKey, "STARTER" | "GROWTH" | "PRO">> = {
  STARTER: "STARTER",
  BUSINESS: "GROWTH",
  GROWTH: "GROWTH",
  PRO: "PRO",
};

/**
 * Native Shopify Billing API. Does not touch Wix or Webflow card checkout.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const planKey = PLANS[(url.searchParams.get("plan") ?? "").toUpperCase()];
  if (!planKey) {
    return NextResponse.redirect(new URL("/billing?error=plan", getAppOrigin()));
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", getAppOrigin()));
  }

  if (!isShopifyPlatform(resolveSitePlatform(session.platform))) {
    return NextResponse.redirect(new URL("/billing", getAppOrigin()));
  }

  try {
    const result = await createShopifyBillingConfirmation({
      organizationId: session.organizationId,
      siteId: session.siteId,
      planKey,
    });
    // Absolute Shopify Admin confirmation URL (RecurringApplicationCharge approve screen).
    // Callers should open this with target="_top" so it is not trapped in the app iframe.
    const confirm = new URL(result.confirmationUrl);
    if (url.searchParams.get("format") === "json") {
      return NextResponse.json({ confirmationUrl: confirm.toString() });
    }
    return NextResponse.redirect(confirm, 303);
  } catch (error) {
    console.error("Shopify billing start failed", error);
    if (url.searchParams.get("format") === "json") {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "checkout_failed" },
        { status: 502 },
      );
    }
    return NextResponse.redirect(new URL("/billing?error=checkout", getAppOrigin()));
  }
}
