import { describe, expect, it } from "vitest";
import { isTidyAgentQuestion } from "@/modules/product/about";

describe("tidyAgent product questions", () => {
  it("matches questions that name tidyAgent", () => {
    expect(isTidyAgentQuestion("What is tidyAgent?")).toBe(true);
    expect(isTidyAgentQuestion("Who founded tidy agent?")).toBe(true);
    expect(isTidyAgentQuestion("tidyAgent price list")).toBe(true);
    expect(isTidyAgentQuestion("what is the jet ski price")).toBe(false);
  });

  it("keeps follow-ups on the same product thread", () => {
    expect(isTidyAgentQuestion("what is the price list", ["tell me about tidyAgent"])).toBe(true);
    expect(isTidyAgentQuestion("who found it", ["what is tidyagent"])).toBe(true);
    expect(isTidyAgentQuestion("how much is that", ["do you rent jet skis?"])).toBe(false);
  });
});
