import { describe, expect, it } from "vitest";
import {
  INSTALL_GUIDES,
  SHOPIFY_INSTALL_GUIDE,
  WEBFLOW_INSTALL_GUIDE,
  installGuideFor,
} from "@/modules/platforms/install-guide";
import { SHOPIFY_OAUTH_SCOPES } from "@/modules/shopify/scopes";
import { WEBFLOW_OAUTH_SCOPES } from "@/modules/webflow/scopes";

describe("install guide", () => {
  it("documents every OAuth scope for both platforms", () => {
    expect(WEBFLOW_INSTALL_GUIDE.permissions.map((p) => p.scope)).toEqual([...WEBFLOW_OAUTH_SCOPES]);
    expect(SHOPIFY_INSTALL_GUIDE.permissions.map((p) => p.scope)).toEqual([...SHOPIFY_OAUTH_SCOPES]);
  });

  it("resolves platform focus from query-like values", () => {
    expect(installGuideFor("webflow")?.id).toBe("webflow");
    expect(installGuideFor("SHOPIFY")?.id).toBe("shopify");
    expect(installGuideFor("nope")).toBeNull();
    expect(INSTALL_GUIDES).toHaveLength(2);
  });
});
