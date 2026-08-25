import { describe, expect, it } from "vitest";
import { listedAmountToCents, normalizeStripeCurrency } from "@/modules/billing/stripe/amounts";
import { mapStripeSubscriptionStatus, parseStripePlanKey } from "@/modules/billing/stripe/status";

describe("stripe amounts", () => {
  it("converts listed Admin prices to Stripe cents", () => {
    expect(listedAmountToCents("19")).toBe(1900);
    expect(listedAmountToCents("19.99")).toBe(1999);
    expect(listedAmountToCents(" 49 ")).toBe(4900);
    expect(listedAmountToCents("")).toBeNull();
    expect(listedAmountToCents("$19")).toBeNull();
    expect(listedAmountToCents("0")).toBeNull();
  });

  it("normalizes currency codes for Stripe", () => {
    expect(normalizeStripeCurrency("USD")).toBe("usd");
    expect(normalizeStripeCurrency(" eur ")).toBe("eur");
    expect(normalizeStripeCurrency("")).toBe("usd");
  });
});

describe("stripe status mapping", () => {
  it("maps Business alias and paid statuses", () => {
    expect(parseStripePlanKey("BUSINESS")).toBe("GROWTH");
    expect(parseStripePlanKey("starter")).toBe("STARTER");
    expect(mapStripeSubscriptionStatus("trialing")).toMatchObject({
      status: "TRIALING",
      isFree: false,
    });
    expect(mapStripeSubscriptionStatus("active", true)).toMatchObject({
      status: "ACTIVE",
      isFree: false,
      cancelAtPeriodEnd: true,
    });
    expect(mapStripeSubscriptionStatus("past_due")).toMatchObject({
      status: "PAST_DUE",
      billingIssue: true,
      isFree: false,
    });
    expect(mapStripeSubscriptionStatus("canceled")).toMatchObject({
      status: "CANCELED",
      isFree: true,
    });
  });
});
