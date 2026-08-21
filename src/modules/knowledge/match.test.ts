import { describe, expect, it } from "vitest";
import { compactPhrase, isHandoffRequest, isJunkBusinessName, textMatchesTerms } from "@/modules/knowledge/match";
import { isUsefulOfferName } from "@/modules/knowledge/facts";
import { formatFactsAnswer } from "@/modules/conversations/reply";

describe("smart matching", () => {
  it("matches jetski to jet ski without being site-specific", () => {
    expect(compactPhrase("4 Hour Jet Skis")).toContain("jetski");
    expect(textMatchesTerms("4 Hours Jet Skis — $500", ["jetski"])).toBe(true);
    expect(textMatchesTerms("Pontoon rental — $1500", ["jetski"])).toBe(false);
  });

  it("treats connect-me as a real handoff request", () => {
    expect(isHandoffRequest("Please connect me with human")).toBe(true);
    expect(isHandoffRequest("yes please connect?")).toBe(true);
    expect(isHandoffRequest("Are you connecting me?")).toBe(true);
    expect(isHandoffRequest("what is the jet ski price")).toBe(false);
  });

  it("rejects junk business names", () => {
    expect(isJunkBusinessName("Prices and offerings")).toBe(true);
    expect(isJunkBusinessName("406 Water Sports")).toBe(false);
  });

  it("drops garbage rental labels", () => {
    expect(isUsefulOfferName("Rental In")).toBe(false);
    expect(isUsefulOfferName("4 Hours Jet Skis")).toBe(true);
  });

  it("answers only the asked item when several prices exist", () => {
    const reply = formatFactsAnswer("jetski for 2 people what is the price", [
      { entity: "4 Hours Jet Skis", value: "$500", kind: "PRICE" },
      { entity: "24 Hours Pontooning", value: "$1500", kind: "PRICE" },
      { entity: "All Day Full Day", value: "$700", kind: "PRICE" },
    ]);
    expect(reply.toLowerCase()).toContain("jet");
    expect(reply).toContain("$500");
    expect(reply).not.toContain("$1500");
  });
});
