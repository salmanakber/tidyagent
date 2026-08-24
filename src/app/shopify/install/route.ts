import { NextResponse } from "next/server";
import { createShopifyOAuthState, shopifyAuthorizeUrl } from "@/modules/shopify/oauth";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { getAppOrigin } from "@/lib/env";
import { normalizeShopifyShop } from "@/modules/shopify/shop";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const bounce = bounceOffBindAddress(request, origin);
  if (bounce) return NextResponse.redirect(bounce);

  const config = await getShopifyOAuthConfig();
  if (!config.enabled) {
    return NextResponse.redirect(new URL("/shopify/missing?error=disabled", origin));
  }
  if (!config.apiKey) {
    return NextResponse.redirect(new URL("/shopify/missing?error=not_configured", origin));
  }

  const url = new URL(request.url);
  const shop = normalizeShopifyShop(url.searchParams.get("shop"));
  if (!shop) {
    return NextResponse.redirect(new URL("/shopify/missing?error=no_shop", origin));
  }

  const state = await createShopifyOAuthState({
    shop,
    embed: url.searchParams.get("embedded") === "1" || url.searchParams.get("embed") === "1",
  });
  return NextResponse.redirect(
    shopifyAuthorizeUrl({
      shop,
      apiKey: config.apiKey,
      redirectUri: config.redirectUri,
      state,
    }),
  );
}

function bounceOffBindAddress(request: Request, origin: string) {
  let appHost: string;
  try {
    appHost = new URL(origin).hostname;
  } catch {
    return null;
  }
  if (isBindAddress(appHost)) return null;

  const incoming =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    new URL(request.url).host;
  const incomingHost = incoming.split(":")[0];
  if (!isBindAddress(incomingHost)) return null;

  const current = new URL(request.url);
  return new URL(`${current.pathname}${current.search}`, origin);
}

function isBindAddress(hostname: string) {
  return hostname === "0.0.0.0" || hostname === "127.0.0.1" || hostname === "::" || hostname === "[::]";
}
