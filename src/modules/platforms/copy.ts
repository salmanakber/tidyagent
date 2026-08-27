import { isShopifyPlatform, isWebflowPlatform, isWixPlatform, platformLabel, type SitePlatform } from "@/modules/platforms/types";

/**
 * Rewrite marketplace-specific product copy so a tenant never sees another platform's name.
 * Wix strings stay as-is for Wix tenants.
 */
export function copyForPlatform(platform: SitePlatform | string | null | undefined, text: string) {
  if (isWixPlatform(platform)) return text;
  const name = platformLabel(platform);

  let out = text
    .replace(/\bWix Stores catalog\b/gi, platform === "SHOPIFY" ? "product catalog" : "store catalog")
    .replace(/\bWix Stores\b/gi, platform === "SHOPIFY" ? "product catalog" : "store catalog")
    .replace(/\bWix Bookings\b/gi, "bookings")
    .replace(/\bWix CMS\b/gi, platform === "WEBFLOW" ? "CMS" : "content")
    .replace(/\bWix App Market\b/gi, "billing")
    .replace(/\bWix APIs\b/gi, `${name} APIs`)
    .replace(/\bWix site profile\b/gi, `${name} site profile`)
    .replace(/\bWix site\b/gi, `${name} site`)
    .replace(/\bon a Wix site\b/gi, `on a ${name} site`)
    .replace(/\bWix\b/g, name);

  if (isWebflowPlatform(platform)) {
    out = out
      .replace(/\bShopify\b/gi, "the store")
      .replace(/\bApp Store\b/gi, "marketplace")
      .replace(/\bFull-domain crawl plus\b/gi, "Webflow Data APIs:")
      .replace(/\bFull website crawl,\b/gi, "Webflow pages, CMS, and")
      .replace(
        /Reads every public page we can find \(sitemap and on-site links\), plus/gi,
        "Reads site profile, pages, and CMS through Webflow Data APIs, plus",
      )
      .replace(/every public page we can find/gi, "Webflow pages via Data APIs")
      .replace(/sitemap and on-site links/gi, "official Webflow APIs");
  }
  if (isShopifyPlatform(platform)) {
    out = out
      .replace(/\bWebflow\b/gi, "the site")
      .replace(/\bApp Market\b/gi, "App Store");
  }

  return out;
}

export function bulletsForPlatform(platform: SitePlatform | string | null | undefined, bullets: string[]) {
  return bullets.map((item) => copyForPlatform(platform, item));
}

/** Onboarding scan/embed copy. Wix strings stay the production wording. */
export function wizardCopyForPlatform(platform?: string | null) {
  if (isWixPlatform(platform)) {
    return {
      connected: (siteName: string, planLabel: string) =>
        `${siteName} is identified through Wix. The next step is a real read of the live site — scoped to ${planLabel} — so the employee learns this business, not a generic script.`,
      autoInstall: "Adds the widget to every published page.",
      manualInstall: "Place the widget only where you want it in the Wix Editor.",
      scanStages: [
        "Confirming the Wix site",
        "Reading every public page",
        "Loading the Wix Stores catalog",
        "Writing a business understanding",
      ],
      noUrl: "No public URL yet — publish the Wix site, then scan.",
      crawlHint: "Sitemap, on-site links, and Wix data. Uncheck to read only common pages like pricing, services, and FAQ.",
      storeHint: "from Wix Stores",
      factsHint: "Structured prices, contact details, hours, and services extracted from the live site and Wix APIs.",
      knowledgeDescription: (name: string) =>
        `The scanner reads every public page it can find on this ${name} site, plus Wix Stores on Business and Pro. Custom notes you add sit above that and are never overwritten.`,
      scanButton: "Read and understand this website",
      scanPending: "Reading website…",
      scanLiveNote: "This reads the live site. It is not a canned demo.",
      hideDomainCrawlToggle: false,
    };
  }
  if (platform === "SHOPIFY") {
    return {
      connected: (siteName: string, planLabel: string) =>
        `${siteName} is identified through Shopify. The next step is a real read of the live store — scoped to ${planLabel} — so the employee learns this business, not a generic script.`,
      autoInstall: "Adds the widget to the storefront with a script tag.",
      manualInstall: "Place the widget only where you want it in the theme editor.",
      scanStages: [
        "Confirming the Shopify store",
        "Reading every public page",
        "Loading the product catalog",
        "Writing a business understanding",
      ],
      noUrl: "No public URL yet — publish the Shopify store, then scan.",
      crawlHint: "Sitemap, on-site links, Admin catalog, and Online Store pages. Uncheck to read only common pages like pricing, services, and FAQ.",
      storeHint: "from the product catalog",
      factsHint: "Structured prices, contact details, hours, and services extracted from the live storefront and Shopify Admin APIs.",
      knowledgeDescription: (name: string) =>
        `The scanner reads every public page it can find on this ${name} store, plus the product catalog on Business and Pro. Custom notes you add sit above that and are never overwritten.`,
      scanButton: "Read and understand this website",
      scanPending: "Reading website…",
      scanLiveNote: "This reads the live site. It is not a canned demo.",
      hideDomainCrawlToggle: false,
    };
  }
  const name = platformLabel(platform);
  return {
    connected: (siteName: string, planLabel: string) =>
      `${siteName} is identified through ${name}. The next step is a real read of your Webflow site through official Data APIs — scoped to ${planLabel} — so the employee learns this business, not a generic script.`,
    autoInstall: "Adds the widget through site-wide custom code. Publish the site so visitors can see it.",
    manualInstall: "We'll still inject site-wide custom code. Choose this only if you will place the snippet yourself.",
    scanStages: [
      "Confirming the Webflow site",
      "Reading pages via Webflow APIs",
      "Loading CMS and ecommerce data",
      "Writing a business understanding",
    ],
    noUrl: "No public URL yet — publish the Webflow site, then scan.",
    crawlHint:
      "tidyAgent reads your Webflow site through official Data APIs (site profile, pages, CMS, ecommerce when available). It does not crawl or scrape the published domain.",
    storeHint: "from the ecommerce catalog",
    factsHint: "Structured prices, contact details, hours, and services extracted from Webflow Data APIs.",
    knowledgeDescription: (nameLabel: string) =>
      `Knowledge for this ${nameLabel} site comes from official Webflow Data APIs (pages, CMS, and ecommerce on Business and Pro) — not from crawling the published domain. Custom notes you add sit above that and are never overwritten.`,
    scanButton: "Read site via Webflow APIs",
    scanPending: "Reading Webflow APIs…",
    scanLiveNote: "This uses Webflow Data APIs only. It is not a domain crawl.",
    hideDomainCrawlToggle: true,
  };
}
