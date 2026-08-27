import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security/session";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { fetchShopifyShop } from "@/modules/shopify/client";
import { ensureShopifyWidgetForSite } from "@/modules/shopify/embed";
import { provisionTenantFromShopify } from "@/modules/shopify/provision";
import { shopFromIdTokenClaims, validateShopifyIdToken } from "@/modules/shopify/session-token";
import { exchangeShopifySessionToken } from "@/modules/shopify/tokens";

export const dynamic = "force-dynamic";

/**
 * Embedded Shopify Admin entry: App Bridge ID token → expiring offline token → tidyAgent session.
 * Stays inside the admin iframe (no top-level OAuth breakout / cookie loop).
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

  let claims;
  try {
    claims = validateShopifyIdToken(idToken, config.apiKey, config.apiSecret);
  } catch {
    const response = NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    response.headers.set("X-Shopify-Retry-Invalid-Session-Request", "1");
    return response;
  }

  const shop = shopFromIdTokenClaims(claims);
  if (!shop) {
    return NextResponse.json({ error: "Invalid shop" }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await exchangeShopifySessionToken({
      shop,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      idToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token exchange failed";
    // Stale ID token — ask App Bridge to retry once with a fresh token.
    if (/400|expired|invalid/i.test(message)) {
      const response = NextResponse.json({ error: "Invalid session token" }, { status: 401 });
      response.headers.set("X-Shopify-Retry-Invalid-Session-Request", "1");
      return response;
    }
    console.error("Shopify session token exchange failed", error);
    return NextResponse.json({ error: "Could not connect this Shopify store" }, { status: 502 });
  }

  const shopRecord = await fetchShopifyShop(shop, tokens.accessToken).catch(() => null);
  const session = await provisionTenantFromShopify({
    shop,
    shopRecord,
    accessToken: tokens.accessToken,
    scope: tokens.scope,
    tokens,
  });

  await ensureShopifyWidgetForSite(session.siteId, tokens.accessToken).catch((error) => {
    console.error("Shopify widget inject after session exchange failed", error);
  });

  const destination = await workspacePathForOrganization(session.organizationId);
  const cookie = await createSessionToken(session);
  const response = NextResponse.json({ ok: true, redirect: destination });
  response.cookies.set(SESSION_COOKIE, cookie, sessionCookieOptions());
  return response;
}
