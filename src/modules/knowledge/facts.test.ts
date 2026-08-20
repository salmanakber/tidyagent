import { describe, expect, it } from "vitest";
import { extractJsonLdNodes, factsFromJsonLd, pageFactsBlock } from "@/modules/knowledge/facts";

describe("structured page facts", () => {
  it("reads Product JSON-LD name, price, and url", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Deep clean","offers":{"@type":"Offer","price":"149","priceCurrency":"USD"},"url":"https://example.com/deep-clean"}</script>`;
    const facts = factsFromJsonLd(extractJsonLdNodes(html));
    expect(facts.some((line) => /Deep clean/.test(line) && /149/.test(line))).toBe(true);
  });

  it("builds a prices block from visible currency amounts", () => {
    const block = pageFactsBlock("<p></p>", "Starter is $19 / month and Pro is $99/mo");
    expect(block).toContain("PRICES AND ITEMS");
    expect(block).toMatch(/\$19/);
  });
});
