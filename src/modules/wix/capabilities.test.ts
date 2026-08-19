import { describe, expect, it } from "vitest";
import { detectWixCapabilities } from "@/modules/wix/capabilities";
import { mapWixPackageToPlan, resolveEntitlements } from "@/modules/billing/entitlements";

describe("capability detection", () => {
  it("enables ecommerce tools only when Stores is installed", () => {
    const withStores = detectWixCapabilities(["Stores", "Blog"]);
    expect(withStores.hasStores).toBe(true);
    expect(withStores.tools.find((tool) => tool.key === "cart")?.available).toBe(true);

    const withoutStores = detectWixCapabilities(["Bookings"]);
    expect(withoutStores.hasStores).toBe(false);
    expect(withoutStores.tools.find((tool) => tool.key === "cart")?.available).toBe(false);
  });
});

describe("entitlements", () => {
  it("never treats frontend plan claims as source of truth", () => {
    const server = resolveEntitlements({ planKey: "FREE", status: "NONE", isFree: true });
    expect(server.voiceEnabled).toBe(false);
    expect(server.advancedToolsEnabled).toBe(false);
    expect(mapWixPackageToPlan("growth-yearly")).toBe("GROWTH");
  });
});
