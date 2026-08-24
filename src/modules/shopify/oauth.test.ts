import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyQueryHmac } from "@/modules/shopify/hmac";
import { shopifyAuthorizeUrl } from "@/modules/shopify/oauth";
import { normalizeShopifyShop } from "@/modules/shopify/shop";
import { syntheticInstanceId } from "@/modules/platforms/types";

describe("shopify helpers", () => {
  it("normalizes myshopify domains and rejects junk", () => {
    expect(normalizeShopifyShop("https://Cool-Shop.myshopify.com/admin")).toBe("cool-shop.myshopify.com");
    expect(normalizeShopifyShop("not-a-shop.com")).toBeNull();
    expect(normalizeShopifyShop("https://evil.com/?shop=cool-shop.myshopify.com")).toBeNull();
  });

  it("builds the authorize URL for the shop", () => {
    const url = new URL(
      shopifyAuthorizeUrl({
        shop: "cool-shop.myshopify.com",
        apiKey: "key-1",
        redirectUri: "https://agent.tidyflowapp.com/api/shopify/oauth/callback",
        state: "state-1",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://cool-shop.myshopify.com/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("key-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://agent.tidyflowapp.com/api/shopify/oauth/callback",
    );
    expect(url.searchParams.get("scope")).toContain("write_script_tags");
  });

  it("accepts a valid Shopify query HMAC and rejects a tampered one", () => {
    const secret = "shpss_test_secret";
    const search = new URLSearchParams({
      shop: "cool-shop.myshopify.com",
      timestamp: "1710000000",
      hmac: "placeholder",
    });
    search.delete("hmac");
    const message = [...search.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const hmac = createHmac("sha256", secret).update(message).digest("hex");
    search.set("hmac", hmac);
    expect(verifyShopifyQueryHmac(search, secret)).toBe(true);
    search.set("shop", "other.myshopify.com");
    expect(verifyShopifyQueryHmac(search, secret)).toBe(false);
    expect(syntheticInstanceId("SHOPIFY", "cool-shop.myshopify.com")).toBe(
      "shopify:cool-shop.myshopify.com",
    );
  });
});
