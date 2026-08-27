import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { shopFromIdTokenClaims, validateShopifyIdToken } from "@/modules/shopify/session-token";

function signIdToken(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

describe("shopify session token", () => {
  it("validates a signed App Bridge ID token", () => {
    const apiKey = "api-key-1";
    const secret = "shpss_test_secret";
    const now = Math.floor(Date.now() / 1000);
    const token = signIdToken(
      {
        iss: "https://cool-shop.myshopify.com/admin",
        dest: "https://cool-shop.myshopify.com",
        aud: apiKey,
        sub: "1",
        exp: now + 60,
        nbf: now - 5,
        iat: now,
      },
      secret,
    );
    const claims = validateShopifyIdToken(token, apiKey, secret);
    expect(shopFromIdTokenClaims(claims)).toBe("cool-shop.myshopify.com");
  });

  it("rejects a bad audience", () => {
    const secret = "shpss_test_secret";
    const now = Math.floor(Date.now() / 1000);
    const token = signIdToken(
      {
        iss: "https://cool-shop.myshopify.com/admin",
        dest: "https://cool-shop.myshopify.com",
        aud: "other-key",
        sub: "1",
        exp: now + 60,
        nbf: now - 5,
        iat: now,
      },
      secret,
    );
    expect(() => validateShopifyIdToken(token, "api-key-1", secret)).toThrow(/audience/i);
  });
});
