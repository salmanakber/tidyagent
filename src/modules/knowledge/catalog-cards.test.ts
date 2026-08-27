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

  it("reads a Shopify-style featured image and images list", () => {
    expect(
      productImageFromRecord({
        featuredImage: { url: "https://cdn.shopify.com/s/files/1/product.jpg" },
        images: [{ src: "https://cdn.shopify.com/s/files/1/other.jpg" }],
      }),
    ).toBe("https://cdn.shopify.com/s/files/1/product.jpg");
    expect(
      productImageFromRecord({
        images: { edges: [{ node: { url: "https://cdn.shopify.com/s/files/1/edge.jpg" } }] },
      }),
    ).toBe("https://cdn.shopify.com/s/files/1/edge.jpg");
  });

  it("builds rich cards from Shopify-style metadata", () => {
    const card = cardFromMetadata({
      title: "Trail Jacket — USD 89",
      sourceUrl: "https://shop.example.com/products/trail-jacket",
      cleanedContent: "Trail Jacket\nWaterproof shell for wet weather.",
      metadata: {
        name: "Trail Jacket",
        price: "USD 89",
        imageUrl: "https://cdn.shopify.com/s/files/1/jacket.jpg",
        url: "https://shop.example.com/products/trail-jacket",
        data: {
          vendor: "Northline",
          productType: "Outerwear",
          tags: ["waterproof", "hiking"],
          descriptionHtml: "<p>Waterproof shell for wet weather.</p>",
          variants: {
            edges: [
              { node: { title: "Small", price: "89.00", availableForSale: true } },
              { node: { title: "Large", price: "89.00", availableForSale: true } },
            ],
          },
        },
      },
    });
    expect(card?.name).toBe("Trail Jacket");
    expect(card?.price).toBe("USD 89");
    expect(card?.description).toMatch(/Waterproof/i);
    expect(card?.variants?.map((row) => row.title)).toEqual(expect.arrayContaining(["Small", "Large"]));
    expect(card?.vendor).toBe("Northline");
  });

  it("matches product questions using description and tags", () => {
    const cards = matchCatalogCards("do you have a waterproof hiking jacket?", [
      {
        name: "Trail Jacket",
        price: "USD 89",
        description: "Waterproof shell for wet weather",
        tags: ["waterproof", "hiking"],
        imageUrl: "https://cdn.example.com/jacket.jpg",
      },
      { name: "Wool Socks", price: "USD 12", imageUrl: "https://cdn.example.com/socks.jpg" },
    ]);
    expect(cards[0]?.name).toBe("Trail Jacket");
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

  it("does not turn page titles into offer cards", () => {
    expect(
      cardFromMetadata({
        title: "406watersports | Boat and Jet Ski Rental | Whitefish, MT, USA",
        sourceUrl: "https://example.com/",
      }),
    ).toBeNull();
    expect(
      cardFromMetadata({
        title: "Top Whitefish Montana Watersports: Jet Ski, Flyboarding &amp; Lake Adventures",
        sourceUrl: "https://example.com/about",
      }),
    ).toBeNull();
  });

  it("keeps priced offers and drops priceless page cards on a price-list question", () => {
    const cards = matchCatalogCards("tell me the price list", [
      { name: "406watersports | Boat and Jet Ski Rental | Whitefish, MT, USA" },
      { name: "JET SKI", price: "$500", imageUrl: "https://cdn.example.com/ski.jpg" },
      { name: "Top Whitefish Montana Watersports: Jet Ski, Flyboarding & Lake Adventures" },
      { name: "4-Hour Rental", price: "$500" },
      { name: "Deep Clean", price: "$149" },
    ]);
    expect(cards.every((card) => card.price)).toBe(true);
    expect(cards.map((card) => card.name)).not.toEqual(
      expect.arrayContaining([
        "406watersports | Boat and Jet Ski Rental | Whitefish, MT, USA",
        "Top Whitefish Montana Watersports: Jet Ski, Flyboarding & Lake Adventures",
      ]),
    );
  });
});
