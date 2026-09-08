import { NextResponse } from "next/server";
import type { PlanKey } from "@prisma/client";
import { getAppOrigin } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/security/session";
import { syncShopifyBillingFromShop } from "@/modules/shopify/billing";
import { isShopifyPlatform } from "@/modules/platforms";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { shopifyEmbeddedAdminAppUrl, shopifyReconnectPath } from "@/modules/shopify/open";
import { normalizeShopifyShop } from "@/modules/shopify/shop";

export const dynamic = "force-dynamic";

const PLANS: Record<string, Extract<PlanKey, "STARTER" | "GROWTH" | "PRO">> = {
  STARTER: "STARTER",
  BUSINESS: "GROWTH",
  GROWTH: "GROWTH",
  PRO: "PRO",
};

/**
 * Return URL after the merchant approves (or declines) a Shopify app charge.
 * Resolves the shop from query params (like tidySync) so it does not depend on
 * the partitioned iframe session cookie after a top-level Shopify redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getAppOrigin();
  const planKey = PLANS[(url.searchParams.get("plan") ?? "").toUpperCase()] ?? null;
  const siteId = url.searchParams.get("siteId");
  const shopParam = url.searchParams.get("shop");
  const session = await getSession();

  const site =
    (siteId
      ? await prisma.wixSite.findUnique({ where: { id: siteId } })
      : null) ||
    (shopParam
      ? await prisma.wixSite.findFirst({
          where: {
            platform: "SHOPIFY",
            shopifyShopDomain: normalizeShopifyShop(shopParam) || shopParam,
          },
        })
      : null) ||
    (session?.siteId
      ? await prisma.wixSite.findUnique({ where: { id: session.siteId } })
      : null);

  if (!site || !isShopifyPlatform(site.platform)) {
    return NextResponse.redirect(new URL(shopParam ? shopifyReconnectPath(shopParam) : "/", origin));
  }

  try {
    await syncShopifyBillingFromShop({
      organizationId: site.organizationId,
      siteId: site.id,
      preferredPlanKey: planKey,
    });
  } catch (error) {
    console.error("Shopify billing sync failed", error);
    return NextResponse.redirect(new URL("/billing?error=checkout", origin));
  }

  const shop = site.shopifyShopDomain || shopParam || "";
  const { apiKey } = await getShopifyOAuthConfig();
  const embedded = shop && apiKey ? shopifyEmbeddedAdminAppUrl(shop, apiKey) : null;
  if (embedded) {
    return NextResponse.redirect(embedded);
  }

  return NextResponse.redirect(new URL(shop ? shopifyReconnectPath(shop) : "/billing?checkout=success", origin));
}
