import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { getSetting } from "@/lib/security/settings";
import { verifyPassword } from "@/lib/security/passwords";

export const ADMIN_COOKIE = "tidyagent_admin";
export const IMPERSONATION_COOKIE = "tidyagent_impersonation";

export type PlatformAdminRole = "SUPER" | "SUPPORT" | "ANALYST";

export type AdminSession = {
  type: "platform";
  adminId: string;
  email: string;
  name: string;
  role: PlatformAdminRole;
};

type Claims = JWTPayload & AdminSession;

function secretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export function allowedAdminEmails() {
  const env = getEnv();
  const extras = env.PLATFORM_ADMIN_EMAILS.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([env.PLATFORM_ADMIN_EMAIL.toLowerCase(), ...extras]));
}

export async function getOperatorEmails() {
  const env = getEnv();
  const primary = (await getSetting("platform_admin_email", env.PLATFORM_ADMIN_EMAIL)).trim().toLowerCase();
  const extras = (await getSetting("platform_admin_emails", env.PLATFORM_ADMIN_EMAILS))
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([primary, ...extras].filter(Boolean)));
}

export async function verifyAdminPassword(email: string, password: string) {
  const env = getEnv();
  const emails = await getOperatorEmails();
  if (!emails.includes(email.trim().toLowerCase())) return false;

  const storedHash = await getSetting("platform_admin_password_hash");
  if (storedHash) {
    return verifyPassword(password, storedHash);
  }

  if (!env.PLATFORM_ADMIN_PASSWORD) return false;
  const left = createHash("sha256").update(password).digest();
  const right = createHash("sha256").update(env.PLATFORM_ADMIN_PASSWORD).digest();
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createAdminToken(session: AdminSession) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());
}

export async function readAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const claims = payload as Claims;
    if (claims.type !== "platform" || !claims.email || !claims.adminId) return null;
    return {
      type: "platform",
      adminId: claims.adminId,
      email: claims.email,
      name: claims.name,
      role: claims.role,
    };
  } catch {
    return null;
  }
}

export async function setAdminCookie(session: AdminSession) {
  const token = await createAdminToken(session);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  store.delete(IMPERSONATION_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return readAdminToken(token);
}

export async function requireAdminSession(minRole: PlatformAdminRole = "ANALYST"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new AdminRequiredError();
  if (!roleAllows(session.role, minRole)) throw new AdminRequiredError();
  return session;
}

export function roleAllows(actual: PlatformAdminRole, min: PlatformAdminRole) {
  const rank = { ANALYST: 1, SUPPORT: 2, SUPER: 3 };
  return rank[actual] >= rank[min];
}

export async function setImpersonationFlag(adminEmail: string) {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, adminEmail, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
}

export async function getImpersonation(): Promise<string | null> {
  const store = await cookies();
  return store.get(IMPERSONATION_COOKIE)?.value ?? null;
}

export async function clearImpersonation() {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}

export class AdminRequiredError extends Error {
  constructor() {
    super("Platform admin required");
    this.name = "AdminRequiredError";
  }
}
