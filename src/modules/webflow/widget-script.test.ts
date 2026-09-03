import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WEBFLOW_EMBED_VERSION,
  webflowEmbedCanonicalUrl,
  webflowEmbedHostedLocation,
  webflowEmbedIntegrityHash,
} from "@/modules/webflow/widget-script";

describe("webflow hosted widget script", () => {
  it("builds a versioned hosted URL with instance config in the query string", () => {
    const url = webflowEmbedHostedLocation("https://agent.tidyflowapp.com", "wf:site-99");
    expect(url).toContain("https://agent.tidyflowapp.com/widget/embed.js");
    expect(url).toContain(`v=${WEBFLOW_EMBED_VERSION}`);
    expect(url).toContain("instance=wf%3Asite-99");
    expect(webflowEmbedCanonicalUrl("https://agent.tidyflowapp.com")).not.toContain("instance=");
  });

  it("computes sha384 integrity for the on-disk production executable", async () => {
    const hash = await webflowEmbedIntegrityHash();
    expect(hash.startsWith("sha384-")).toBe(true);
    const bytes = readFileSync(path.join(process.cwd(), "public", "widget", "embed.js"));
    const expected = `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
    expect(hash).toBe(expected);
  });
});
