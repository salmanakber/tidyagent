import { describe, expect, it } from "vitest";
import {
  isReviewerEmail,
  isWixReviewMode,
  pickHigherPlan,
  reviewComplimentaryPlan,
  reviewerEmails,
} from "@/modules/auth/reviewer";

describe("Wix App Market reviewer access", () => {
  it("reads reviewer emails from env", () => {
    const previous = process.env.WIX_REVIEWER_EMAIL;
    const extras = process.env.WIX_REVIEWER_EMAILS;
    process.env.WIX_REVIEWER_EMAIL = "wix-reviewer@tidyflowapp.com";
    process.env.WIX_REVIEWER_EMAILS = "qa@example.com, Review@Wix.com ";
    expect(reviewerEmails()).toEqual([
      "wix-reviewer@tidyflowapp.com",
      "qa@example.com",
      "review@wix.com",
    ]);
    expect(isReviewerEmail("QA@example.com")).toBe(true);
    expect(isReviewerEmail("someone@else.com")).toBe(false);
    if (previous === undefined) delete process.env.WIX_REVIEWER_EMAIL;
    else process.env.WIX_REVIEWER_EMAIL = previous;
    if (extras === undefined) delete process.env.WIX_REVIEWER_EMAILS;
    else process.env.WIX_REVIEWER_EMAILS = extras;
  });

  it("unlocks Pro while review mode is on, without a stored grant", () => {
    const previous = process.env.WIX_REVIEW_MODE;
    process.env.WIX_REVIEW_MODE = "true";
    expect(isWixReviewMode()).toBe(true);
    expect(reviewComplimentaryPlan({ storedGrant: null, ownerEmail: "random@site.com" })).toBe("PRO");
    process.env.WIX_REVIEW_MODE = "false";
    expect(reviewComplimentaryPlan({ storedGrant: null, ownerEmail: "random@site.com" })).toBeNull();
    expect(pickHigherPlan("STARTER", "PRO")).toBe("PRO");
    expect(pickHigherPlan("PRO", "STARTER")).toBe("PRO");
    if (previous === undefined) delete process.env.WIX_REVIEW_MODE;
    else process.env.WIX_REVIEW_MODE = previous;
  });
});
