import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeShopifyShop } from "@/modules/shopify/shop";

export type ShopifyIdTokenClaims = {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti?: string;
  sid?: string;
};

function b64urlJson(segment: string) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return JSON.parse(Buffer.from(padded + pad, "base64").toString("utf8")) as Record<string, unknown>;
}

/**
 * Validate Shopify App Bridge session / ID token (HS256 with app client secret).
 */
export function validateShopifyIdToken(idToken: string, apiKey: string, apiSecret: string): ShopifyIdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid ID token format");
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = b64urlJson(headerB64);
  if (header.alg !== "HS256") throw new Error("Unsupported ID token algorithm");

  const expected = createHmac("sha256", apiSecret).update(`${headerB64}.${payloadB64}`).digest();
  const actual = Buffer.from(signatureB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid ID token signature");
  }

  const payload = b64urlJson(payloadB64) as Partial<ShopifyIdTokenClaims>;
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new Error("ID token expired");
  if (payload.nbf && payload.nbf > now + 60) throw new Error("ID token not yet valid");
  if (String(payload.aud) !== apiKey) throw new Error("ID token audience mismatch");
  if (!payload.iss || !payload.dest) throw new Error("ID token missing iss/dest");

  const issuerHost = new URL(String(payload.iss)).hostname;
  const destHost = new URL(String(payload.dest)).hostname;
  if (issuerHost !== destHost) throw new Error("ID token issuer/destination mismatch");

  const shop = normalizeShopifyShop(destHost);
  if (!shop) throw new Error("ID token shop is invalid");

  return {
    iss: String(payload.iss),
    dest: String(payload.dest),
    aud: String(payload.aud),
    sub: String(payload.sub || ""),
    exp: Number(payload.exp),
    nbf: Number(payload.nbf || 0),
    iat: Number(payload.iat || 0),
    jti: payload.jti ? String(payload.jti) : undefined,
    sid: payload.sid ? String(payload.sid) : undefined,
  };
}

export function shopFromIdTokenClaims(claims: ShopifyIdTokenClaims) {
  return normalizeShopifyShop(new URL(claims.dest).hostname);
}
