import { NextResponse } from "next/server";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { verifyShopifyWebhookHmac } from "@/modules/shopify/hmac";

export const dynamic = "force-dynamic";

/**
 * Mandatory Shopify privacy webhooks. We acknowledge and log; no Wix paths are involved.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const config = await getShopifyOAuthConfig();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyWebhookHmac(rawBody, hmac, config.apiSecret)) {
    return NextResponse.json({ error: "invalid hmac" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "unknown";
  const shop = request.headers.get("x-shopify-shop-domain") ?? "";
  console.info("Shopify webhook", { topic, shop });
  return NextResponse.json({ ok: true });
}
