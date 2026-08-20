import { describe, expect, it } from "vitest";
import { formatEvidenceAnswer, isCasualOpener, isPriceQuestion, subjectTerms } from "@/modules/conversations/reply";

describe("visitor openers", () => {
  it("treats hi/hello as greetings, not missing knowledge", () => {
    expect(isCasualOpener("Hi")).toBe(true);
    expect(isCasualOpener("hello!")).toBe(true);
    expect(isCasualOpener("Good morning")).toBe(true);
    expect(isCasualOpener("Do you deliver on Friday?")).toBe(false);
    expect(isCasualOpener("What are your hours?")).toBe(false);
  });

  it("detects price questions", () => {
    expect(isPriceQuestion("what is the price of deep clean?")).toBe(true);
    expect(isPriceQuestion("How much does it cost")).toBe(true);
    expect(isPriceQuestion("Do you deliver on Friday?")).toBe(false);
  });

  it("keeps the asked item and does not dump page titles", () => {
    expect(subjectTerms("deep clean price")).toEqual(expect.arrayContaining(["deep", "clean", "price"]));
    const dump = formatEvidenceAnswer("deep clean prices", [
      {
        title: "Prices and offerings",
        content: "Verified prices and named items from the live site and catalog. Harbor Clean Co | Residential Cleaning",
      },
    ]);
    expect(dump.toLowerCase()).not.toContain("verified prices");
    expect(dump.toLowerCase()).not.toContain("harbor clean co |");
    const priced = formatEvidenceAnswer("deep clean prices", [
      {
        title: "Packages",
        content: "Deep Clean — $149\nWindow Wash — $89\nMove-out Clean — $249",
      },
    ]);
    expect(priced).toMatch(/\$149/);
    expect(priced.toLowerCase()).toContain("deep");
  });
});
