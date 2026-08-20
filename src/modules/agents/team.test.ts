import { describe, expect, it } from "vitest";
import { classifyVisitorIntent, pickAgentForIntent, maxAgentsForPlan } from "@/modules/agents/team";

describe("agent routing", () => {
  it("sends product questions to the ecommerce specialist", () => {
    expect(classifyVisitorIntent("Do you have this product in stock?")).toBe("ECOMMERCE");
    const team = [
      { isPrimary: true, specialty: "GENERAL" as const, status: "ACTIVE" },
      { isPrimary: false, specialty: "ECOMMERCE" as const, status: "ACTIVE" },
    ];
    expect(pickAgentForIntent(team, "ECOMMERCE")?.specialty).toBe("ECOMMERCE");
  });

  it("stays with the general agent when no specialist exists", () => {
    const team = [{ isPrimary: true, specialty: "GENERAL" as const, status: "ACTIVE" }];
    expect(pickAgentForIntent(team, "ECOMMERCE")?.specialty).toBe("GENERAL");
  });

  it("limits extra agents to Business and Pro", () => {
    expect(maxAgentsForPlan("STARTER")).toBe(1);
    expect(maxAgentsForPlan("GROWTH")).toBe(4);
    expect(maxAgentsForPlan("PRO")).toBe(8);
  });
});
