import { describe, expect, it } from "vitest";
import { detectFactConflicts, factsFromPage, normalizeEntityKey, normalizeFactValue } from "@/modules/knowledge/structured";

describe("structured business facts", () => {
  it("extracts labeled service prices from a page", () => {
    const facts = factsFromPage({
      url: "https://harbor.example.com/packages",
      title: "Cleaning packages",
      description: "",
      headings: ["2 HOUR SESSION", "HALF DAY PACKAGE"],
      text: `2 HOUR SESSION\n120 Minutes\n$400\nHALF DAY PACKAGE\n$600`,
      emails: ["hello@harbor.example.com"],
      phones: ["+1 503 555 0199"],
      links: [],
      contentType: "SERVICE",
      jsonLd: [],
    });
    expect(facts.some((fact) => fact.kind === "PRICE" && /400/.test(fact.value))).toBe(true);
    expect(facts.some((fact) => fact.kind === "CONTACT" && fact.entity === "email")).toBe(true);
    expect(facts.some((fact) => fact.kind === "CONTACT" && fact.entity === "phone")).toBe(true);
  });

  it("detects price conflicts instead of picking a winner", () => {
    const conflicts = detectFactConflicts([
      {
        kind: "PRICE",
        entity: "Starter Plan",
        entityKey: normalizeEntityKey("Starter Plan"),
        value: "$19",
        sourceUrl: "https://example.com/a",
        extractionMethod: "html",
        confidence: "HIGH",
      },
      {
        kind: "PRICE",
        entity: "Starter Plan",
        entityKey: normalizeEntityKey("Starter plans"),
        value: "$29",
        sourceUrl: "https://example.com/b",
        extractionMethod: "html",
        confidence: "HIGH",
      },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.values).toHaveLength(2);
  });

  it("treats $400.00 and $400 as the same value", () => {
    expect(normalizeFactValue("$400.00")).toBe("$400");
    expect(normalizeFactValue("$400")).toBe("$400");
  });
});
