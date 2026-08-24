import { describe, expect, it } from "vitest";
import { readWebflowOAuthState, webflowAuthorizeUrl } from "@/modules/webflow/oauth";
import { isEmbeddedWebflowRequest, isWebflowOpenRequest } from "@/modules/webflow/open";
import { pickWebflowSite, sitePublicUrl, widgetInlineSource } from "@/modules/webflow/sites";
import { syntheticInstanceId } from "@/modules/platforms/types";

describe("webflow oauth helpers", () => {
  it("builds the authorize URL with the registered redirect and required scopes", () => {
    const url = new URL(
      webflowAuthorizeUrl({
        clientId: "client-1",
        redirectUri: "https://agent.tidyflowapp.com/api/webflow/oauth/callback",
        state: "state-token",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://webflow.com/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://agent.tidyflowapp.com/api/webflow/oauth/callback",
    );
    expect(url.searchParams.get("scope")).toContain("custom_code:write");
    expect(url.searchParams.get("scope")).toContain("authorized_user:read");
  });

  it("picks a preferred site, then a custom domain, then the most recently published", () => {
    const sites = [
      { id: "a", displayName: "A", lastPublished: "2024-01-01T00:00:00.000Z" },
      {
        id: "b",
        displayName: "B",
        lastPublished: "2025-01-01T00:00:00.000Z",
        customDomains: [{ url: "https://shop.example.com" }],
      },
    ];
    expect(pickWebflowSite(sites, "a")?.id).toBe("a");
    expect(pickWebflowSite(sites)?.id).toBe("b");
    expect(sitePublicUrl(sites[1]!)).toBe("https://shop.example.com");
    expect(sitePublicUrl({ id: "c", shortName: "studio" })).toBe("https://studio.webflow.io");
  });

  it("injects the widget with the synthetic Webflow instance id", () => {
    const instanceId = syntheticInstanceId("WEBFLOW", "site-99");
    const source = widgetInlineSource("https://agent.tidyflowapp.com/widget.js", instanceId);
    expect(instanceId).toBe("wf:site-99");
    expect(source).toContain("https://agent.tidyflowapp.com/widget.js");
    expect(source).toContain("wf:site-99");
    expect(source).not.toContain("<script");
  });
});

describe("webflow app home detection", () => {
  it("treats webflow.com referers and site ids as Open app", () => {
    expect(isWebflowOpenRequest({ referer: "https://webflow.com/dashboard" })).toBe(true);
    expect(isWebflowOpenRequest({ referer: "https://design.webflow.com/site/abc" })).toBe(true);
    expect(isWebflowOpenRequest({ siteId: "site-1" })).toBe(true);
    expect(isWebflowOpenRequest({ referer: "https://agent.tidyflowapp.com/" })).toBe(false);
    expect(isWebflowOpenRequest({})).toBe(false);
  });

  it("detects Designer Launch iframes even without embed=1", () => {
    expect(isEmbeddedWebflowRequest({ embed: "1" })).toBe(true);
    expect(isEmbeddedWebflowRequest({ dest: "iframe" })).toBe(true);
    expect(
      isEmbeddedWebflowRequest({ referer: "https://d111111abcdef8.cloudfront.net/index.html" }),
    ).toBe(true);
    expect(isEmbeddedWebflowRequest({ dest: "document", site: "cross-site" })).toBe(false);
  });
});

describe("webflow oauth state", () => {
  it("does not reject marketplace state that we did not issue", async () => {
    const parsed = await readWebflowOAuthState("webflow-marketplace-state");
    expect(parsed.ours).toBe(false);
    expect(parsed.siteId).toBeNull();
  });
});
