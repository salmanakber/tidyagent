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

  it("maps Shopify subscription statuses and plan names", () => {
    expect(mapShopifySubscriptionStatus("ACTIVE")).toMatchObject({ status: "ACTIVE", isFree: false });
    expect(mapShopifySubscriptionStatus("FROZEN")).toMatchObject({ status: "PAST_DUE", billingIssue: true });
    expect(mapShopifySubscriptionStatus("CANCELLED")).toMatchObject({ status: "CANCELED", isFree: true });
    expect(parsePlanKeyFromSubscriptionName("tidyAgent Business")).toBe("GROWTH");
    expect(parsePlanKeyFromSubscriptionName("tidyAgent Pro")).toBe("PRO");
    expect(parsePlanKeyFromSubscriptionName("tidyAgent Starter")).toBe("STARTER");
  });
});
