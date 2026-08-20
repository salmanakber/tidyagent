import { describe, expect, it } from "vitest";
import { bulletsForPlanScope, defaultPlanScope, mergePlanScope } from "@/modules/billing/plan-scopes";

describe("plan scopes", () => {
  it("keeps shipped defaults for Business (4 agents, no voice)", () => {
    const growth = defaultPlanScope("GROWTH");
    expect(growth.maxAgents).toBe(4);
    expect(growth.voiceEnabled).toBe(false);
    expect(growth.automations.specialist_routing).toBe(true);
    expect(growth.automations.greeting).toBe(true);
  });

  it("overlays admin edits without dropping unspecified flags", () => {
    const next = mergePlanScope("STARTER", {
      maxAgents: 3,
      voiceEnabled: true,
      automations: { shopping: true },
    });
    expect(next.maxAgents).toBe(3);
    expect(next.voiceEnabled).toBe(true);
    expect(next.automations.shopping).toBe(true);
    expect(next.automations.greeting).toBe(true);
    expect(next.conversationLimit).toBe(1000);
  });

  it("lists live limits in marketing bullets", () => {
    const bullets = bulletsForPlanScope("STARTER", {
      ...defaultPlanScope("STARTER"),
      maxAgents: 3,
      voiceEnabled: true,
    });
    expect(bullets.some((item) => item.includes("3 agents"))).toBe(true);
    expect(bullets.some((item) => /spoken replies/i.test(item))).toBe(true);
  });
});
