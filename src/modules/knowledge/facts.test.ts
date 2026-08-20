import { describe, expect, it } from "vitest";
import { extractJsonLdNodes, extractLabeledPrices, factsFromJsonLd, pageFactsBlock } from "@/modules/knowledge/facts";

describe("structured page facts", () => {
  it("reads Product JSON-LD name, price, and url", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Deep clean","offers":{"@type":"Offer","price":"149","priceCurrency":"USD"},"url":"https://example.com/deep-clean"}</script>`;
    const facts = factsFromJsonLd(extractJsonLdNodes(html));
    expect(facts.some((line) => /Deep clean/.test(line) && /149/.test(line))).toBe(true);
    expect(facts.some((line) => /https:\/\//.test(line))).toBe(false);
  });

  it("builds a prices block from visible currency amounts", () => {
    const block = pageFactsBlock("<p></p>", "Starter is $19 / month and Pro is $99/mo");
    expect(block).toContain("PRICES AND ITEMS");
    expect(block).toMatch(/\$19/);
  });

  it("pairs offer names with nearby prices", () => {
    const text = `
2 HOUR SESSION
120 Minutes residential cleaning
Up to 12 rooms
$400

HALF DAY PACKAGE
Half day deep clean
$600

FULL DAY SERVICE
$900
`;
    const labeled = extractLabeledPrices(text);
    expect(labeled.some((line) => /session/i.test(line) && /\$400/.test(line))).toBe(true);
    expect(labeled.some((line) => /\$600/.test(line))).toBe(true);
    expect(labeled.some((line) => /\$900/.test(line))).toBe(true);
  });
});
