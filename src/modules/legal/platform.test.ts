import { describe, expect, it } from "vitest";
import { legalBillingBlurb, legalHref, parseLegalPlatformParam } from "@/modules/legal/platform";

describe("legal platform helpers", () => {
  it("parses platform query values", () => {
    expect(parseLegalPlatformParam("webflow")).toBe("WEBFLOW");
    expect(parseLegalPlatformParam("SHOPIFY")).toBe("SHOPIFY");
    expect(parseLegalPlatformParam("sy")).toBe("SHOPIFY");
    expect(parseLegalPlatformParam("wf")).toBe("WEBFLOW");
    expect(parseLegalPlatformParam("nope")).toBeNull();
  });

  it("keeps Wix terms URL clean and versions others", () => {
    expect(legalHref("/terms", "WIX")).toBe("/terms");
    expect(legalHref("/privacy", "WEBFLOW")).toBe("/privacy?platform=webflow");
    expect(legalHref("/terms", "SHOPIFY")).toBe("/terms?platform=sy");
    expect(legalHref("/privacy", "SHOPIFY")).toBe("/privacy?platform=sy");
  });

  it("does not mention Wix billing on Webflow/Shopify blurbs", () => {
    expect(legalBillingBlurb("WEBFLOW").plans).not.toMatch(/Wix/i);
    expect(legalBillingBlurb("SHOPIFY").plans).not.toMatch(/Wix/i);
    expect(legalBillingBlurb("WIX").plans).toMatch(/Wix App Market/);
  });
});
