import { describe, expect, it } from "vitest";
import { isNonExpiringTokenError, merchantShopifyError } from "@/modules/shopify/tokens";
import { ShopifyApiError } from "@/modules/shopify/client";
import { shopifyEmbeddedAdminAppUrl } from "@/modules/shopify/open";

describe("shopify tokens helpers", () => {
  it("detects non-expiring token rejection messages", () => {
    expect(
      isNonExpiringTokenError(
        new ShopifyApiError(
          'Shopify POST /script_tags.json failed (403): {"errors":"[API] Non-expiring access tokens are no longer accepted for the Admin API."}',
          403,
        ),
      ),
    ).toBe(true);
    expect(isNonExpiringTokenError(new Error("missing scope"))).toBe(false);
  });

  it("returns merchant-friendly widget errors", () => {
    expect(
      merchantShopifyError(
        new ShopifyApiError("Non-expiring access tokens are no longer accepted for the Admin API", 403),
      ),
    ).toMatch(/reopen tidyAgent/i);
    expect(merchantShopifyError(new ShopifyApiError("boom", 403))).toMatch(/Shopify Admin/i);
  });

  it("builds the embedded admin app URL", () => {
    expect(shopifyEmbeddedAdminAppUrl("cool-shop.myshopify.com", "api-key-1")).toBe(
      "https://admin.shopify.com/store/cool-shop/apps/api-key-1",
    );
  });
});
