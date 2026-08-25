import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyWebhookHmac } from "@/modules/shopify/hmac";

describe("shopify privacy webhook contract", () => {
  it("returns false for a bad HMAC so the route can 401", () => {
    const secret = "shpss_test";
    const body = JSON.stringify({ shop_domain: "cool-shop.myshopify.com" });
    const good = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(verifyShopifyWebhookHmac(body, good, secret)).toBe(true);
    expect(verifyShopifyWebhookHmac(body, "tampered", secret)).toBe(false);
    expect(verifyShopifyWebhookHmac(body, null, secret)).toBe(false);
  });
});
