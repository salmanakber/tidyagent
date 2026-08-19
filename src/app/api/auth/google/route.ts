import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getGoogleOAuthConfig } from "@/lib/security/settings";
import { getEnv } from "@/lib/env";

export async function GET() {
  const { clientId, redirectUri } = await getGoogleOAuthConfig();
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google", getEnv().APP_URL));
  }

  const state = await new SignJWT({ intent: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(getEnv().SESSION_SECRET));

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(url);
}
