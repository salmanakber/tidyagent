import { describe, expect, it } from "vitest";
import { parseReviewerEmails, pickHigherPlan, reviewComplimentaryPlan } from "@/modules/auth/reviewer";

describe("Wix App Market reviewer access", () => {
  it("parses reviewer emails from primary + extras", () => {
    expect(parseReviewerEmails("wix-reviewer@tidyflowapp.com", "qa@example.com, Review@Wix.com ")).toEqual([
      "wix-reviewer@tidyflowapp.com",
      "qa@example.com",
      "review@wix.com",
    ]);
    expect(parseReviewerEmails("wix-reviewer@tidyflowapp.com", "wix-reviewer@tidyflowapp.com")).toEqual([
      "wix-reviewer@tidyflowapp.com",
    ]);
  });

  it("unlocks Pro while review mode is on, without a stored grant", () => {
    expect(
      reviewComplimentaryPlan({
        storedGrant: null,
        ownerEmail: "random@site.com",
        reviewMode: true,
        reviewerEmails: ["wix-reviewer@tidyflowapp.com"],
      }),
    ).toBe("PRO");
    expect(
      reviewComplimentaryPlan({
        storedGrant: null,
        ownerEmail: "random@site.com",
        reviewMode: false,
        reviewerEmails: ["wix-reviewer@tidyflowapp.com"],
      }),
    ).toBeNull();
    expect(
      reviewComplimentaryPlan({
        storedGrant: null,
        ownerEmail: "wix-reviewer@tidyflowapp.com",
        reviewMode: false,
        reviewerEmails: ["wix-reviewer@tidyflowapp.com"],
      }),
    ).toBe("PRO");
    expect(pickHigherPlan("STARTER", "PRO")).toBe("PRO");
    expect(pickHigherPlan("PRO", "STARTER")).toBe("PRO");
  });
});
