import { NextResponse } from "next/server";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { verifyShopifyWebhookHmac } from "@/modules/shopify/hmac";
import { dispatchShopifyPrivacyWebhook } from "@/modules/shopify/privacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Mandatory Shopify privacy webhooks (+ future topics).
 * Returns 401 on bad HMAC (App Store compliance check). Never touches Wix data.
 *
 * Register via Partner Dashboard URL and/or shopify.app.toml + `shopify app deploy`.
 * Endpoint: https://agent.tidyflowapp.com/api/shopify/webhooks
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

  try {
    await dispatchShopifyPrivacyWebhook(topic, shop, rawBody);
  } catch (error) {
    console.error("Shopify webhook handler failed", { topic, shop, error });
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
