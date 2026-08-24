import { NextResponse } from "next/server";
import { createWebflowOAuthState, webflowAuthorizeUrl } from "@/modules/webflow/oauth";
import { getWebflowOAuthConfig } from "@/modules/platforms/marketplace";
import { getAppOrigin } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const bounce = bounceOffBindAddress(request, origin);
  if (bounce) return NextResponse.redirect(bounce);

  const config = await getWebflowOAuthConfig();
  if (!config.enabled) {
    return NextResponse.redirect(new URL("/webflow/missing?error=disabled", origin));
  }
  if (!config.clientId) {
    return NextResponse.redirect(new URL("/webflow/missing?error=not_configured", origin));
  }

  const state = await createWebflowOAuthState();
  return NextResponse.redirect(
    webflowAuthorizeUrl({
      clientId: config.clientId,
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
