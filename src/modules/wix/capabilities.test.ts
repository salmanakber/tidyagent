import { describe, expect, it } from "vitest";
import { detectWixCapabilities } from "@/modules/wix/capabilities";
import { mapWixPackageToPlan, resolveEntitlements, withComplimentaryGrant } from "@/modules/billing/entitlements";

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
    expect(server.isPaidSeat).toBe(false);
    expect(server.isUsable).toBe(false);
    expect(mapWixPackageToPlan("growth-yearly")).toBe("GROWTH");
    expect(mapWixPackageToPlan("business-monthly")).toBe("GROWTH");
    expect(mapWixPackageToPlan("Starter")).toBe("STARTER");
    expect(mapWixPackageToPlan("Pro")).toBe("PRO");
  });

  it("locks the product until a plan is purchased, including trial", () => {
    const trial = resolveEntitlements({ planKey: "STARTER", status: "TRIALING", isFree: false });
    expect(trial.isPaidSeat).toBe(true);
    expect(trial.isUsable).toBe(true);
  });

  it("treats an admin grant as a paid seat on a free Wix install", () => {
    const free = resolveEntitlements({ planKey: "FREE", status: "NONE", isFree: true });
    const granted = withComplimentaryGrant(free, "GROWTH");
    expect(granted.isPaidSeat).toBe(true);
    expect(granted.isUsable).toBe(true);
    expect(granted.grantedByAdmin).toBe(true);
    expect(granted.planKey).toBe("GROWTH");
    expect(granted.advancedToolsEnabled).toBe(true);
  });

  it("keeps a higher Wix purchase when the admin grant is lower", () => {
    const paid = resolveEntitlements({ planKey: "PRO", status: "ACTIVE", isFree: false });
    const granted = withComplimentaryGrant(paid, "STARTER");
    expect(granted.planKey).toBe("PRO");
    expect(granted.grantedByAdmin).toBe(true);
    expect(granted.voiceEnabled).toBe(true);
  });

  it("still locks a granted seat when the site is suspended", () => {
    const free = resolveEntitlements({ planKey: "FREE", status: "NONE", isFree: true, suspended: true });
    const granted = withComplimentaryGrant(free, "PRO", true);
    expect(granted.isPaidSeat).toBe(true);
    expect(granted.isUsable).toBe(false);
    expect(granted.grantedByAdmin).toBe(true);
  });
});
