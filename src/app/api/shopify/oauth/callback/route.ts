import { NextResponse } from "next/server";
import { completeShopifyLogin, ShopifyInstallError } from "@/modules/shopify/oauth";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security/session";
import { getAppOrigin } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const bounce = bounceOffBindAddress(request, origin);
  if (bounce) return NextResponse.redirect(bounce);

  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/shopify/missing?error=denied", origin));
  }

  try {
    const { session, destination } = await completeShopifyLogin({ search: url.searchParams });
    const token = await createSessionToken(session);
    const response = NextResponse.redirect(new URL(destination, origin));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    const codeName = error instanceof ShopifyInstallError ? error.code : "token";
    console.error("Shopify OAuth callback failed", error);
    return NextResponse.redirect(
      new URL(`/shopify/missing?error=${encodeURIComponent(codeName)}`, origin),
    );
  }
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
