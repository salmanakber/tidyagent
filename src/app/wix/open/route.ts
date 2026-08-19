import { NextResponse } from "next/server";
import { completeWixLogin } from "@/modules/auth/wix-open";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/security/session";
import { getAppOrigin } from "@/lib/env";

export async function GET(request: Request) {
  const origin = getAppOrigin();
  const url = new URL(request.url);
  const bounce = bounceOffBindAddress(request, origin);
  if (bounce) {
    return NextResponse.redirect(bounce);
  }

  const instance = url.searchParams.get("instance");

  if (!instance) {
    return NextResponse.redirect(new URL("/wix/missing", origin));
  }

  try {
    const { session, destination } = await completeWixLogin(instance);
    const token = await createSessionToken(session);
    const response = NextResponse.redirect(new URL(destination, origin));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.redirect(new URL("/wix/missing?error=invalid", origin));
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
