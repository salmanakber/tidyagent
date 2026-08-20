import { describe, expect, it } from "vitest";
import { isCasualOpener, isPriceQuestion } from "@/modules/conversations/reply";

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
});
