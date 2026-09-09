import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WEBFLOW_EMBED_VERSION,
  webflowInlineLoaderSource,
  webflowWidgetCanonicalUrl,
  webflowWidgetExecutableLocation,
  webflowEmbedIntegrityHash,
} from "@/modules/webflow/widget-script";

describe("webflow inline widget script", () => {
  it("builds the production widget.js URL with instance config", () => {
    const url = webflowWidgetExecutableLocation("https://agent.tidyflowapp.com", "wf:site-99");
    expect(url).toContain("https://agent.tidyflowapp.com/widget.js");
    expect(url).toContain(`v=${WEBFLOW_EMBED_VERSION}`);
    expect(url).toContain("instance=wf%3Asite-99");
    expect(url).not.toContain("/widget/embed.js");
    expect(webflowWidgetCanonicalUrl("https://agent.tidyflowapp.com")).toBe(
      "https://agent.tidyflowapp.com/widget.js",
    );
  });

  it("builds inline loader source under 2000 characters that loads widget.js", () => {
    const source = webflowInlineLoaderSource("https://agent.tidyflowapp.com", "wf:site-99");
    expect(source.length).toBeLessThanOrEqual(2000);
    expect(source).toContain("/widget.js");
    expect(source).toContain("wf:site-99");
    expect(source).not.toContain("/widget/embed.js");
    expect(source).not.toContain("registered_scripts/hosted");
  });

  it("computes sha384 integrity for on-disk widget.js", async () => {
    const hash = await webflowEmbedIntegrityHash();
    expect(hash.startsWith("sha384-")).toBe(true);
    const bytes = readFileSync(path.join(process.cwd(), "public", "widget.js"));
    const expected = `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
    expect(hash).toBe(expected);
  });
});
