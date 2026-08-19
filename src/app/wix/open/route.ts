import { NextResponse } from "next/server";
import { completeWixLogin } from "@/modules/auth/wix-open";
import { createSessionToken, SESSION_COOKIE } from "@/lib/security/session";
import { getEnv } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const instance = url.searchParams.get("instance");

  if (!instance) {
    return NextResponse.redirect(new URL("/wix/missing", url.origin));
  }

  try {
    const { session, destination } = await completeWixLogin(instance);
    const token = await createSessionToken(session);
    const response = NextResponse.redirect(new URL(destination, url.origin));
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: getEnv().NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/wix/missing?error=invalid", url.origin));
  }
}
