import { describe, expect, it } from "vitest";
import {
  listedAmountToShopifyDecimal,
  mapShopifySubscriptionStatus,
  parsePlanKeyFromSubscriptionName,
} from "@/modules/shopify/billing";

describe("shopify billing helpers", () => {
  it("converts listed Admin prices to Shopify decimal amounts", () => {
    expect(listedAmountToShopifyDecimal("19")).toBe("19.00");
    expect(listedAmountToShopifyDecimal("19.99")).toBe("19.99");
    expect(listedAmountToShopifyDecimal("$19")).toBeNull();
  });

  it("detects Shopify App Pricing Billing API blocks and builds the hosted plan URL", async () => {
    const { isShopifyAppPricingBlockedError, shopifyManagedPricingPlansUrl } = await import(
      "@/modules/shopify/billing"
    );
    expect(
      isShopifyAppPricingBlockedError(
        "Cannot use the Billing API (to create charges) when on Shopify App Pricing.",
      ),
    ).toBe(true);
    expect(
      shopifyManagedPricingPlansUrl("sixer-b2b.myshopify.com", "tidyagent"),
    ).toBe("https://admin.shopify.com/store/sixer-b2b/charges/tidyagent/pricing_plans");
  });
});
