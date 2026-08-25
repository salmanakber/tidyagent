import { NextResponse } from "next/server";
import type { PlanKey } from "@prisma/client";
import { getAppOrigin } from "@/lib/env";
import { getSession } from "@/lib/security/session";
import { createStripeCheckoutSession } from "@/modules/billing/stripe/checkout";
import { isStripeCheckoutConfigured } from "@/modules/billing/stripe/config";
import { isShopifyPlatform, isWebflowPlatform, isWixPlatform, resolveSitePlatform } from "@/modules/platforms";

export const dynamic = "force-dynamic";

const PLANS: Record<string, PlanKey> = {
  STARTER: "STARTER",
  BUSINESS: "GROWTH",
  GROWTH: "GROWTH",
  PRO: "PRO",
};

/**
 * Card checkout for Webflow only.
 * Wix → /api/billing/checkout. Shopify → /api/billing/shopify/checkout.
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

  const platform = resolveSitePlatform(session.platform);
  if (isWixPlatform(platform)) {
    return NextResponse.redirect(new URL(`/api/billing/checkout?plan=${planKey}`, getAppOrigin()));
  }
  if (isShopifyPlatform(platform)) {
    return NextResponse.redirect(
      new URL(`/api/billing/shopify/checkout?plan=${planKey}`, getAppOrigin()),
    );
  }
  if (!isWebflowPlatform(platform)) {
    return NextResponse.redirect(new URL("/billing", getAppOrigin()));
  }

  if (!(await isStripeCheckoutConfigured())) {
    return NextResponse.redirect(new URL("/billing?error=checkout_config", getAppOrigin()));
  }

  try {
    const checkout = await createStripeCheckoutSession({
      organizationId: session.organizationId,
      siteId: session.siteId,
      platform,
      planKey,
      email: session.email,
      name: session.name,
    });
    return NextResponse.redirect(checkout.url);
  } catch (error) {
    console.error("Checkout failed", error);
    return NextResponse.redirect(new URL("/billing?error=checkout", getAppOrigin()));
  }
}
