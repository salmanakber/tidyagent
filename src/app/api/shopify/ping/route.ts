import { NextResponse } from "next/server";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { validateShopifyIdToken } from "@/modules/shopify/session-token";

export const dynamic = "force-dynamic";

/**
 * Lightweight session-token validation for embedded dashboard pages.
 * Shopify's automated "session tokens" check records idToken() activity in the browser.
 */
export async function POST(request: Request) {
  const config = await getShopifyOAuthConfig();
  if (!config.enabled || !config.apiKey || !config.apiSecret) {
    return NextResponse.json({ error: "Shopify is not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") || "";
  const idToken = auth.replace(/^Bearer\s+/i, "").trim();
  if (!idToken) {
    const response = NextResponse.json({ error: "Missing session token" }, { status: 401 });
    response.headers.set("X-Shopify-Retry-Invalid-Session-Request", "1");
    return response;
  }

  try {
    validateShopifyIdToken(idToken, config.apiKey, config.apiSecret);
  } catch {
    const response = NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    response.headers.set("X-Shopify-Retry-Invalid-Session-Request", "1");
    return response;
  }

  return NextResponse.json({ ok: true });
}
