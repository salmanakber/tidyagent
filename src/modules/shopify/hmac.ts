import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verify Shopify OAuth / app-home query HMAC. */
export function verifyShopifyQueryHmac(search: URLSearchParams, secret: string) {
  const hmac = search.get("hmac");
  if (!hmac || !secret) return false;
  const message = [...search.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  return safeEqual(digest, hmac);
}

/** Verify Shopify webhook HMAC (base64 of raw body). */
export function verifyShopifyWebhookHmac(rawBody: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return safeEqual(digest, header);
}
