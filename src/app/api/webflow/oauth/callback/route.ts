import { NextResponse } from "next/server";
import { completeWebflowLogin, WebflowInstallError } from "@/modules/webflow/oauth";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security/session";
import { getAppOrigin } from "@/lib/env";

export const dynamic = "force-dynamic";

function mapOauthError(raw: string | null) {
  const code = (raw || "denied").toLowerCase();
  if (code === "access_denied") return "denied";
  if (code === "invalid_scope") return "invalid_scope";
  if (code === "invalid_request") return "invalid_request";
  if (code === "unauthorized_client") return "unauthorized_client";
  if (code === "server_error" || code === "temporarily_unavailable") return "oauth_server";
  return code.replace(/[^a-z0-9_-]/gi, "").slice(0, 64) || "denied";
}

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const bounce = bounceOffBindAddress(request, origin);
  if (bounce) return NextResponse.redirect(bounce);

  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const mapped = mapOauthError(oauthError);
    const desc = url.searchParams.get("error_description") || "";
    console.error("Webflow OAuth authorize error", { oauthError, desc });
    const target = new URL(`/webflow/missing?error=${encodeURIComponent(mapped)}`, origin);
    if (desc) target.searchParams.set("detail", desc.slice(0, 300));
    return NextResponse.redirect(target);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/webflow/missing?error=missing_code", origin));
  }

  try {
    const { session, destination } = await completeWebflowLogin({
      code,
      state: url.searchParams.get("state"),
      preferredSiteId: url.searchParams.get("siteId") ?? url.searchParams.get("site"),
    });
    const token = await createSessionToken(session);
    const response = NextResponse.redirect(new URL(destination, origin));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    const codeName = error instanceof WebflowInstallError ? error.code : "token";
    console.error("Webflow OAuth callback failed", error);
    return NextResponse.redirect(
      new URL(`/webflow/missing?error=${encodeURIComponent(codeName)}`, origin),
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
