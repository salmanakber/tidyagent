import { describe, expect, it } from "vitest";
import { capabilitiesForSite } from "@/modules/platforms/capabilities";

describe("capabilitiesForSite", () => {
  it("keeps the Wix path on installed apps, including missing platform", () => {
    const wix = capabilitiesForSite({ platform: "WIX", installedWixApps: ["Stores", "Blog"] });
    expect(wix.hasStores).toBe(true);
    expect(wix.hasBlog).toBe(true);
    expect(wix.tools.find((tool) => tool.key === "products")?.source).toBe("wix-app");

    const legacy = capabilitiesForSite({ installedWixApps: ["Bookings"] });
    expect(legacy.hasBookings).toBe(true);
    expect(legacy.hasStores).toBe(false);
  });

  it("does not read Wix apps for Webflow or Shopify", () => {
    const webflow = capabilitiesForSite({
      platform: "WEBFLOW",
      installedWixApps: ["Stores"],
      capabilities: { hasStores: false, source: "webflow" },
    });
    expect(webflow.hasStores).toBe(false);
    expect(webflow.tools.find((tool) => tool.key === "products")?.available).toBe(false);
    expect(webflow.tools.find((tool) => tool.key === "website_content")?.available).toBe(true);

    const shopify = capabilitiesForSite({
      platform: "SHOPIFY",
      installedWixApps: [],
      capabilities: { hasStores: true, source: "shopify" },
    });
    expect(shopify.hasStores).toBe(true);
    expect(shopify.tools.find((tool) => tool.key === "products")?.source).toBe("content");
  });
});
