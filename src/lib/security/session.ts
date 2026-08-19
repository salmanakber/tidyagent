import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "tidyagent_session";

export type SessionRole = "OWNER" | "ADMIN" | "MEMBER";

export type AppSession = {
  userId: string;
  organizationId: string;
  siteId: string;
  wixInstanceId: string;
  wixUserId?: string;
  role: SessionRole;
  email?: string;
  name?: string;
};

type SessionClaims = JWTPayload & AppSession;

function secretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function createSessionToken(session: AppSession) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<AppSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const claims = payload as SessionClaims;
    if (!claims.organizationId || !claims.siteId || !claims.userId) {
      return null;
    }
    return {
      userId: claims.userId,
      organizationId: claims.organizationId,
      siteId: claims.siteId,
      wixInstanceId: claims.wixInstanceId,
      wixUserId: claims.wixUserId,
      role: claims.role,
      email: claims.email,
      name: claims.name,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: AppSession) {
  const token = await createSessionToken(session);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AppSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    throw new SessionRequiredError();
  }
  return session;
}

export class SessionRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "SessionRequiredError";
  }
}
