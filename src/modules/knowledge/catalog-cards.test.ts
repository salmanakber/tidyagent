import { describe, expect, it } from "vitest";
import { matchCatalogCards, isCatalogQuestion, cardFromMetadata } from "@/modules/knowledge/catalog-cards";
import { productImageFromRecord, firstImageUrl } from "@/modules/knowledge/media";

describe("catalog cards", () => {
  it("detects product questions for any kind of site", () => {
    expect(isCatalogQuestion("Do you sell pontoon rentals?")).toBe(true);
    expect(isCatalogQuestion("show me the deep clean package")).toBe(true);
    expect(isCatalogQuestion("what is on the menu")).toBe(true);
    expect(isCatalogQuestion("hello there")).toBe(false);
  });

  it("matches asked items and keeps a photo card", () => {
    const cards = matchCatalogCards("deep clean price", [
      { name: "Window Wash", price: "$89", imageUrl: "https://cdn.example.com/window.jpg" },
      { name: "Deep Clean", price: "$149", imageUrl: "https://cdn.example.com/deep.jpg", url: "https://shop.example.com/deep" },
      { name: "Move-out", price: "$249" },
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.name).toBe("Deep Clean");
    expect(cards[0]?.imageUrl).toContain("deep.jpg");
  });

  it("reads a Wix-style media object", () => {
    expect(
      productImageFromRecord({
        media: { mainMedia: { image: { url: "http://static.wixstatic.com/media/abc.jpg" } } },
      }),
    ).toBe("https://static.wixstatic.com/media/abc.jpg");
    expect(firstImageUrl("//images.example.com/a.png")).toBe("https://images.example.com/a.png");
  });

  it("builds a card from knowledge metadata", () => {
    const card = cardFromMetadata({
      title: "Harbor Pontoon — $1500",
      sourceUrl: "https://example.com/pontoon",
      metadata: { name: "Harbor Pontoon", price: "$1500", imageUrl: "https://cdn.example.com/boat.jpg" },
    });
    expect(card?.name).toBe("Harbor Pontoon");
    expect(card?.price).toBe("$1500");
    expect(card?.imageUrl).toContain("boat.jpg");
  });
});
