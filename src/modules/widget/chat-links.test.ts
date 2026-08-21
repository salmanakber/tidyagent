import { describe, expect, it } from "vitest";
import { linkLabel, rewriteChatLinks, visibleChatText } from "@/modules/widget/chat-links";

describe("chat links", () => {
  it("hides raw urls behind a related phrase", () => {
    const visible = visibleChatText(
      "Book online at https://www.example.com/cms/subscribers08 or see https://shop.example.com/product-page/jet-ski",
    );
    expect(visible.toLowerCase()).not.toContain("https://");
    expect(visible.toLowerCase()).not.toContain("www.");
    expect(visible).toMatch(/book here/i);
    expect(visible).toMatch(/view this/i);
    expect(rewriteChatLinks("see https://example.com/pricing")).toContain("[see prices](");
  });

  it("keeps a human label when it is not a url", () => {
    expect(rewriteChatLinks("[View details](https://example.com/about)")).toBe("[View details](https://example.com/about)");
    expect(linkLabel("https://example.com/contact")).toBe("contact us");
  });
});
