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
 * When the Partner app is on Shopify App Pricing, returns pricingPlansUrl instead.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantJson = url.searchParams.get("format") === "json";
  const planKey = PLANS[(url.searchParams.get("plan") ?? "").toUpperCase()];
  if (!planKey) {
    if (wantJson) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    return NextResponse.redirect(new URL("/billing?error=plan", getAppOrigin()));
  }

  const session = await getSession();
  if (!session) {
    if (wantJson) {
      return NextResponse.json(
        { error: "Session expired. Reopen tidyAgent from Shopify Admin." },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/", getAppOrigin()));
  }

  if (!isShopifyPlatform(resolveSitePlatform(session.platform))) {
    if (wantJson) return NextResponse.json({ error: "Shopify billing only" }, { status: 403 });
    return NextResponse.redirect(new URL("/billing", getAppOrigin()));
  }

  try {
    const result = await createShopifyBillingConfirmation({
      organizationId: session.organizationId,
      siteId: session.siteId,
      planKey,
    });
    const confirm = new URL(result.confirmationUrl);
    if (wantJson) {
      return NextResponse.json({ confirmationUrl: confirm.toString() });
    }
    return NextResponse.redirect(confirm, 303);
  } catch (error) {
    console.error("Shopify billing start failed", error);
    const err = error as Error & { code?: string; pricingPlansUrl?: string | null };
    if (wantJson) {
      return NextResponse.json(
        {
          error: err.message || "checkout_failed",
          code: err.code || "CHECKOUT_FAILED",
          pricingPlansUrl: err.pricingPlansUrl || null,
        },
        { status: err.code === "SHOPIFY_APP_PRICING" ? 409 : 502 },
      );
    }
    if (err.code === "SHOPIFY_APP_PRICING" && err.pricingPlansUrl) {
      return NextResponse.redirect(err.pricingPlansUrl, 303);
    }
    return NextResponse.redirect(new URL("/billing?error=checkout", getAppOrigin()));
  }
}
