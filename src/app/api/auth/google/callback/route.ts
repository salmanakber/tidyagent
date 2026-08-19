import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { getGoogleOAuthConfig } from "@/lib/security/settings";
import { signInUser } from "@/modules/auth/workspace";

export async function GET(request: Request) {
  const env = getEnv();
  const origin = env.APP_URL;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  try {
    await jwtVerify(state, new TextEncoder().encode(env.SESSION_SECRET));
  } catch {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const { clientId, clientSecret, redirectUri } = await getGoogleOAuthConfig();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileRes.json()) as {
    id?: string;
    email?: string;
    name?: string;
  };

  if (!profile.email || !profile.id) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const email = profile.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.id }, { email }] },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        googleId: profile.id,
        name: profile.name || email.split("@")[0],
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: profile.id, name: user.name || profile.name },
    });
  }

  await signInUser(user);
  return NextResponse.redirect(new URL("/dashboard", origin));
}
