import { describe, expect, it } from "vitest";
import { formatListedPrice, platformPriceKeys, priceForPlan } from "@/modules/billing/platform-prices";
import { bulletsForPlatform, copyForPlatform } from "@/modules/platforms/copy";

describe("platform prices", () => {
  it("uses separate setting keys per marketplace", () => {
    expect(platformPriceKeys("WIX").starter).toBe("plan_price_wix_starter");
    expect(platformPriceKeys("WEBFLOW").business).toBe("plan_price_webflow_business");
    expect(platformPriceKeys("SHOPIFY").pro).toBe("plan_price_shopify_pro");
    expect(priceForPlan({ starter: "19", business: "49", pro: "99", currency: "USD" }, "GROWTH")).toBe("49");
    expect(formatListedPrice("19", "$")).toBe("$19");
  });

  it("strips other marketplaces from Webflow copy", () => {
    expect(copyForPlatform("WEBFLOW", "Install on a Wix site")).toBe("Install on a Webflow site");
    expect(copyForPlatform("WEBFLOW", "Wix Stores catalog")).toBe("store catalog");
    expect(bulletsForPlatform("SHOPIFY", ["Wix site profile and pages"])[0]).toBe("Shopify site profile and pages");
    expect(copyForPlatform("WEBFLOW", "Checkout stays on Wix")).not.toMatch(/Wix/);
    expect(copyForPlatform("WEBFLOW", "Checkout stays on Wix")).not.toMatch(/Shopify/i);
    expect(copyForPlatform("SHOPIFY", "Published on Webflow")).not.toMatch(/Webflow/i);
    expect(copyForPlatform("WEBFLOW", "Full-domain crawl plus Wix APIs")).toMatch(/Webflow site/i);
    expect(copyForPlatform("WEBFLOW", "Full-domain crawl plus Wix APIs")).not.toMatch(/crawl/i);
    expect(copyForPlatform("SHOPIFY", "Full-domain crawl plus Wix APIs")).toMatch(/Shopify store/i);
    expect(copyForPlatform("SHOPIFY", "Full-domain crawl plus Wix APIs")).not.toMatch(/crawl/i);
    expect(copyForPlatform("SHOPIFY", "Wix Stores catalog")).toMatch(/ecommerce catalog/i);
  });
});
