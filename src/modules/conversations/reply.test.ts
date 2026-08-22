import { describe, expect, it } from "vitest";
import { formatEvidenceAnswer, formatFactsAnswer, isCasualOpener, isFollowUp, isPriceQuestion, searchQueryFromThread, subjectTerms } from "@/modules/conversations/reply";

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
    expect(priced).toContain("\n\n- **");
  });

  it("strips SEO titles and duplicate marketing lines from a price list", () => {
    const reply = formatFactsAnswer("prices", [
      { entity: "Offerings Flyboard Rentals", value: "$250", kind: "PRICE" },
      { entity: "Flyboard Rentals | 406watersports (https://www.406watersports.com/flyboard)", value: "$250", kind: "PRICE" },
      { entity: "Prices And Offerings", value: "$250", kind: "PRICE" },
      { entity: "Rental Enjoy 24 Hours Of Pontooning Allowing", value: "$1500", kind: "PRICE" },
    ]);
    expect(reply.toLowerCase()).not.toContain("https://");
    expect(reply.toLowerCase()).not.toContain("prices and offerings");
    expect(reply.toLowerCase()).not.toContain("enjoy");
    expect((reply.match(/\$250/g) || []).length).toBe(1);
    expect(reply).toMatch(/\$1500|\$1,500/);
  });

  it("treats short follow-ups as the same thread, not a new topic", () => {
    expect(isFollowUp("how much is that?")).toBe(true);
    expect(isFollowUp("and the 2 hour one")).toBe(true);
    expect(isFollowUp("the other package")).toBe(true);
    expect(isFollowUp("What time is jet ski rental?")).toBe(false);
    expect(searchQueryFromThread("how much is that", ["Do you rent jet skis?"])).toMatch(/jet ski/i);
    expect(searchQueryFromThread("What time is flyboard", ["Do you rent jet skis?"])).toBe("What time is flyboard");
  });
});
