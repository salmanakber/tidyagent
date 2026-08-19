import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

export type WidgetInitToken = {
  organizationId: string;
  siteId: string;
  agentId: string;
};

function secretKey() {
  return new TextEncoder().encode(getEnv().WIDGET_TOKEN_SECRET);
}

/**
 * Signed, site-scoped widget init token.
 * The browser never supplies organization/site IDs — only this token.
 */
export async function createWidgetInitToken(claims: WidgetInitToken) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifyWidgetInitToken(token: string): Promise<WidgetInitToken | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const organizationId = payload.organizationId as string | undefined;
    const siteId = payload.siteId as string | undefined;
    const agentId = payload.agentId as string | undefined;
    if (!organizationId || !siteId || !agentId) return null;
    return { organizationId, siteId, agentId };
  } catch {
    return null;
  }
}
