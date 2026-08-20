import { describe, expect, it } from "vitest";
import { shouldSendWixBiEvent, wixCycleName, wixUpgradeEventData } from "@/modules/wix/bi-events";

describe("Wix BI events", () => {
  it("skips demo and pending instances", () => {
    expect(shouldSendWixBiEvent("abc-instance")).toBe(true);
    expect(shouldSendWixBiEvent("demo-instance-atelier-noir")).toBe(false);
    expect(shouldSendWixBiEvent("pending:user-1")).toBe(false);
    expect(shouldSendWixBiEvent("")).toBe(false);
    expect(shouldSendWixBiEvent(null)).toBe(false);
  });

  it("maps Wix billing cycles to BI cycle_name values", () => {
    expect(wixCycleName("YEARLY")).toBe("yearly");
    expect(wixCycleName("monthly")).toBe("monthly");
    expect(wixCycleName("2 years")).toBe("2 years");
    expect(wixCycleName("ONE_TIME")).toBe("one time");
    expect(wixCycleName("")).toBeUndefined();
  });

  it("includes Wix plan id on upgrade events", () => {
    expect(
      wixUpgradeEventData({
        vendorProductId: "starter-monthly",
        cycle: "MONTHLY",
        reason: "purchase",
      }),
    ).toEqual({
      app_plan_id: "starter-monthly",
      cycle_name: "monthly",
      reason: "purchase",
    });
  });
});
