import { describe, expect, it } from "vitest";
import {
  isWixInstanceTarget,
  isWixPlatform,
  platformLabel,
  resolveSitePlatform,
  syntheticInstanceId,
} from "@/modules/platforms/types";
import { isPlatformAdapterEnabled } from "@/modules/platforms/flags";

describe("site platforms", () => {
  it("treats missing platform as Wix so existing production sessions stay on the Wix path", () => {
    expect(isWixPlatform(undefined)).toBe(true);
    expect(isWixPlatform(null)).toBe(true);
    expect(isWixPlatform("")).toBe(true);
    expect(isWixPlatform("WIX")).toBe(true);
    expect(isWixPlatform("WEBFLOW")).toBe(false);
    expect(isWixPlatform("SHOPIFY")).toBe(false);
    expect(resolveSitePlatform(undefined)).toBe("WIX");
    expect(platformLabel("WEBFLOW")).toBe("Webflow");
    expect(platformLabel("SHOPIFY")).toBe("Shopify");
  });

  it("never sends Webflow or Shopify instance ids to Wix APIs", () => {
    expect(isWixInstanceTarget("a1b2c3-wix-instance")).toBe(true);
    expect(isWixInstanceTarget("pending:user-1")).toBe(true);
    expect(isWixInstanceTarget(syntheticInstanceId("WEBFLOW", "abc"))).toBe(false);
    expect(isWixInstanceTarget(syntheticInstanceId("SHOPIFY", "store.myshopify.com"))).toBe(false);
    expect(isWixInstanceTarget("")).toBe(false);
  });

  it("keeps Wix enabled and leaves other adapters off by default", () => {
    expect(isPlatformAdapterEnabled("WIX")).toBe(true);
    expect(isPlatformAdapterEnabled(undefined)).toBe(true);
    expect(isPlatformAdapterEnabled("WEBFLOW")).toBe(false);
    expect(isPlatformAdapterEnabled("SHOPIFY")).toBe(false);
  });
});
