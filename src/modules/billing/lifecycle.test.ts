import { describe, expect, it } from "vitest";
import {
  applyAutoRenewalCancelled,
  applyPaidPlanPurchased,
  classifyWixEvent,
  deriveFromWixSnapshot,
} from "@/modules/billing/lifecycle";
import { resolveEntitlements } from "@/modules/billing/entitlements";

describe("Wix purchase lifecycle", () => {
  it("treats install as free until a paid plan is purchased", () => {
    const derived = deriveFromWixSnapshot({ isFree: true });
    expect(derived.isFree).toBe(true);
    expect(derived.planKey).toBe("FREE");
    expect(derived.status).toBe("NONE");
  });

  it("treats Paid Plan Purchased with no expiration as a trial seat", () => {
    const derived = applyPaidPlanPurchased({
      eventType: "PaidPlanPurchased",
      vendorProductId: "starter-monthly",
    });
    expect(derived.isFree).toBe(false);
    expect(derived.status).toBe("TRIALING");
    expect(derived.planKey).toBe("STARTER");
  });

  it("does not downgrade on auto-renewal cancellation", () => {
    const paid = applyPaidPlanPurchased({
      eventType: "PaidPlanPurchased",
      vendorProductId: "growth-yearly",
      expiresOn: "2030-01-01T00:00:00.000Z",
    });
    const cancelled = applyAutoRenewalCancelled(
      { eventType: "PaidPlanAutoRenewalCancelled", cancelReason: "USER_CANCEL" },
      paid,
    );
    expect(cancelled.isFree).toBe(false);
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect(cancelled.autoRenewing).toBe(false);
    expect(cancelled.planKey).toBe("GROWTH");

    const entitlements = resolveEntitlements({
      planKey: cancelled.planKey,
      status: cancelled.status,
      isFree: cancelled.isFree,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2030-01-01"),
    });
    expect(entitlements.isPaidSeat).toBe(true);
    expect(entitlements.automationEnabled).toBe(true);
  });

  it("keeps paid access when expiration passed but Wix still says isFree false", () => {
    const derived = deriveFromWixSnapshot({
      isFree: false,
      packageName: "pro-monthly",
      expirationDate: "2020-01-01T00:00:00.000Z",
    });
    expect(derived.billingIssue).toBe(true);
    expect(derived.status).toBe("PAST_DUE");
    const entitlements = resolveEntitlements({
      planKey: derived.planKey,
      status: derived.status,
      isFree: derived.isFree,
      billingIssue: true,
    });
    expect(entitlements.isPaidSeat).toBe(true);
  });

  it("maps Wix Business pricing names to the Business seat", () => {
    const derived = applyPaidPlanPurchased({
      eventType: "PaidPlanPurchased",
      vendorProductId: "Business",
      expiresOn: "2030-01-01T00:00:00.000Z",
    });
    expect(derived.planKey).toBe("GROWTH");
    expect(derived.isFree).toBe(false);
    expect(derived.status).toBe("ACTIVE");
  });

  it("classifies Wix billing webhooks", () => {
    expect(classifyWixEvent("AppInstancePaidPlanPurchased")).toBe("purchased");
    expect(classifyWixEvent("PaidPlanChanged")).toBe("changed");
    expect(classifyWixEvent("Paid Plan Auto Renewal Cancelled")).toBe("cancel_autorenew");
    expect(classifyWixEvent("AppInstanceInstalled")).toBe("installed");
  });
});
