import { describe, expect, it } from "vitest";
import {
  classifyPage,
  extractPage,
  guessServiceUrls,
  isSafeHttpUrl,
  parseSitemapUrls,
  sameSite,
  stripHtml,
} from "@/modules/knowledge/extract";
import { cmsCollectionAllowed, pathPriority, scanScopeForPlan } from "@/modules/knowledge/scan-scope";
import { heuristicUnderstanding } from "@/modules/knowledge/understand";

describe("scan scope", () => {
  it("keeps ecommerce catalog on Starter, Business, and Pro", () => {
    expect(scanScopeForPlan("STARTER").includeStores).toBe(true);
    expect(scanScopeForPlan("STARTER").maxProducts).toBeGreaterThan(0);
    expect(scanScopeForPlan("STARTER").includeCms).toBe(true);
    expect(scanScopeForPlan("STARTER").maxPages).toBeGreaterThan(scanScopeForPlan("FREE").maxPages);
    expect(scanScopeForPlan("GROWTH").includeStores).toBe(true);
    expect(scanScopeForPlan("PRO").maxProducts).toBeGreaterThan(scanScopeForPlan("GROWTH").maxProducts);
  });

  it("lets Starter ingest Stores CMS collections for ecommerce", () => {
    const starter = scanScopeForPlan("STARTER");
    expect(cmsCollectionAllowed("Stores/Products", starter)).toBe(true);
    expect(cmsCollectionAllowed("TeamBios", starter)).toBe(true);
    expect(cmsCollectionAllowed("Members/PrivateMembersData", starter)).toBe(false);
    expect(cmsCollectionAllowed("Stores/Products", scanScopeForPlan("GROWTH"))).toBe(true);
  });

  it("prioritizes pricing URLs ahead of generic pages", () => {
    expect(pathPriority("https://x.com/pricing")).toBeLessThan(pathPriority("https://x.com/blog/hello"));
    expect(pathPriority("https://x.com/services")).toBeLessThan(pathPriority("https://x.com/blog/hello"));
  });
});

describe("site extraction", () => {
  it("rejects private and non-http URLs", () => {
    expect(isSafeHttpUrl("http://127.0.0.1/secret")).toBe(false);
    expect(isSafeHttpUrl("http://192.168.0.12")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("https://studio.example.com/about")).toBe(true);
  });

  it("reads title, description, headings and same-host links", () => {
    const html = `
      <html>
        <head>
          <title>Harbor Clean Co</title>
          <meta name="description" content="Residential cleaning in Portland." />
        </head>
        <body>
          <h1>Deep clean, done right</h1>
          <a href="/faq">FAQ</a>
          <a href="https://evil.example/phish">Ignore</a>
          <p>Book a cleaner for Friday. Returns accepted within 7 days.</p>
        </body>
      </html>
    `;
    const page = extractPage(html, "https://harbor.example.com", 4000);
    expect(page.title).toContain("Harbor Clean Co");
    expect(page.description).toContain("Portland");
    expect(page.headings[0]).toMatch(/Deep clean/i);
    expect(page.links.some((link) => link.includes("/faq"))).toBe(true);
    expect(page.links.some((link) => link.includes("evil.example"))).toBe(false);
    expect(classifyPage("https://harbor.example.com/faq", "FAQ", "help")).toBe("FAQ");
    expect(classifyPage("https://harbor.example.com/pricing", "Rates", "our plans")).toBe("SERVICE");
  });

  it("parses sitemap URLs for the same host only", () => {
    const xml = `
      <urlset>
        <url><loc>https://www.harbor.example.com/about</loc></url>
        <url><loc>https://other.com/steal</loc></url>
      </urlset>
    `;
    expect(parseSitemapUrls(xml, "harbor.example.com", 10)).toEqual([
      "https://www.harbor.example.com/about",
    ]);
    expect(sameSite("https://www.harbor.example.com/x", "harbor.example.com")).toBe(true);
  });

  it("never falls back to a fake fashion store", () => {
    const page = extractPage(
      "<title>Northline Dental</title><meta name='description' content='Family dentistry in Austin.' /><h1>Gentle exams</h1><p>We see kids and adults.</p>",
      "https://northline.example.com",
      2000,
    );
    const understanding = heuristicUnderstanding({
      displayName: "Northline Dental",
      siteUrl: "https://northline.example.com",
      pages: [page],
      products: [],
    });
    expect(understanding.name.toLowerCase()).toContain("northline");
    expect(understanding.summary.toLowerCase()).not.toContain("fashion");
    expect(stripHtml("<script>alert(1)</script><p>Hello   world</p>", 40)).toBe("Hello world");
  });

  it("indexes visible prices onto the page text", () => {
    const page = extractPage(
      `<title>Pricing</title><p>Starter is $19 / month. Pro is $99 per month.</p>`,
      "https://harbor.example.com/pricing",
      4000,
    );
    expect(page.contentType).toBe("SERVICE");
    expect(page.text).toContain("PRICES AND ITEMS");
    expect(page.text).toMatch(/\$19/);
  });

  it("guesses service URLs from homepage headings", () => {
    const urls = guessServiceUrls(
      "https://harbor.example.com",
      ["Deep Clean Packages", "Window Washing"],
      "Residential cleaning packages and pricing",
    );
    expect(urls.some((url) => url.includes("/deep-clean"))).toBe(true);
    expect(urls.some((url) => url.includes("/packages") || url.includes("/pricing"))).toBe(true);
  });
});
