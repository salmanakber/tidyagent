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
    .replace(/\bWix APIs\b/gi, `${name} connection`)
    .replace(/\bWix site profile\b/gi, `${name} site profile`)
    .replace(/\bWix site\b/gi, `${name} site`)
    .replace(/\bon a Wix site\b/gi, `on a ${name} site`)
    .replace(/\bWix\b/g, name);

  if (isWebflowPlatform(platform)) {
    out = out
      .replace(/\bShopify\b/gi, "the store")
      .replace(/\bApp Store\b/gi, "marketplace")
      .replace(/\bFull-domain crawl plus\b/gi, "Your Webflow site:")
      .replace(/\bFull website crawl,\b/gi, "Your Webflow pages, CMS, and")
      .replace(
        /Reads every public page we can find \(sitemap and on-site links\), plus/gi,
        "Reads page metadata, CMS, and store details from Webflow Data APIs, plus",
      )
      .replace(/every public page we can find/gi, "your Webflow page metadata, CMS, and catalog")
      .replace(/sitemap and on-site links/gi, "Webflow Data APIs")
      .replace(/\bWebflow Data APIs\b/gi, "your Webflow site")
      .replace(/\bData APIs\b/gi, "your site");
  }
  if (isShopifyPlatform(platform)) {
    out = out
      .replace(/\bWebflow\b/gi, "the site")
      .replace(/\bApp Market\b/gi, "App Store")
      .replace(/\bFull-domain crawl plus\b/gi, "Your Shopify store:")
      .replace(/\bFull website crawl,\b/gi, "Your Shopify store,")
      .replace(
        /Reads every public page we can find \(sitemap and on-site links\), plus/gi,
        "Reads your store profile, pages, and blogs from Shopify, plus",
      )
      .replace(/every public page we can find/gi, "your store content")
      .replace(/sitemap and on-site links/gi, "your Shopify store")
      .replace(/\bShopify Admin APIs\b/gi, "your Shopify store")
      .replace(/\bAdmin APIs\b/gi, "your store")
      .replace(/\bproduct catalog\b/gi, "ecommerce catalog");
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
        "Loading products & ecommerce",
        "Writing a business understanding",
      ],
      noUrl: "No public URL yet — publish the Wix site, then scan.",
      crawlHint: "Sitemap, on-site links, and Wix data. Uncheck to read only common pages like pricing, services, and FAQ.",
      storeHint: "from your product catalog",
      factsHint: "Prices, contact details, hours, and services pulled from your live site.",
      knowledgeDescription: (name: string) =>
        `We teach your AI employee from this ${name} site — including pages and your ecommerce products on paid plans. Custom notes you add sit above that and are never overwritten.`,
      scanButton: "Read and understand this website",
      scanPending: "Reading website…",
      scanLiveNote: "This reads the live site. It is not a canned demo.",
      hideDomainCrawlToggle: false,
    };
  }
  if (platform === "SHOPIFY") {
    return {
      connected: (siteName: string, planLabel: string) =>
        `${siteName} is connected through Shopify. Next, teach your AI employee this store — scoped to ${planLabel} — so answers match your real products and pages.`,
      autoInstall: "Adds the chat widget to your online store automatically.",
      manualInstall: "Place the widget only where you want it in the theme editor.",
      scanStages: [
        "Confirming your Shopify store",
        "Reading store pages and policies",
        "Loading products & ecommerce",
        "Writing a business understanding",
      ],
      noUrl: "No public store URL yet — publish your Shopify store, then scan.",
      crawlHint:
        "We load your store profile, pages, blogs, and product catalog (prices, images, variants) from your Shopify store. Visitors then get accurate answers in chat.",
      storeHint: "from your ecommerce catalog",
      factsHint: "Prices, contact details, hours, and services pulled from your Shopify store.",
      knowledgeDescription: (name: string) =>
        `We teach your AI employee from this ${name} store — pages, policies, and your full ecommerce catalog (products, prices, and images) on paid plans. Custom notes you add sit above that and are never overwritten.`,
      scanButton: "Teach AI from this store",
      scanPending: "Learning your store…",
      scanLiveNote: "This reads your real Shopify store content and products.",
      hideDomainCrawlToggle: true,
    };
  }
  const name = platformLabel(platform);
  return {
    connected: (siteName: string, planLabel: string) =>
      `${siteName} is connected through ${name}. Next, teach your AI employee this site — scoped to ${planLabel} — so answers match your real page metadata, CMS, and products.`,
    autoInstall: "Adds the widget site-wide. Publish the site so visitors can see it.",
    manualInstall: "We'll still add site-wide code. Choose this only if you will place the snippet yourself.",
    scanStages: [
      "Confirming your Webflow site",
      "Reading page metadata and CMS",
      "Loading products & ecommerce",
      "Writing a business understanding",
    ],
    noUrl: "No public URL yet — publish the Webflow site, then scan.",
    crawlHint:
      "We load site profile, page metadata (title, SEO description, path), CMS items, and ecommerce from Webflow Data APIs — not page DOM content and not a domain crawl.",
    storeHint: "from your ecommerce catalog",
    factsHint: "Contact details and business facts from CMS items, products, and owner notes.",
    knowledgeDescription: (nameLabel: string) =>
      `We teach your AI employee from this ${nameLabel} site — page metadata, CMS, and ecommerce products on paid plans. Full static page body text is not loaded. Custom notes you add sit above that and are never overwritten.`,
    scanButton: "Teach AI from this site",
    scanPending: "Learning your site…",
    scanLiveNote: "This reads Webflow Data APIs (page metadata, CMS, products). It does not scrape your live HTML.",
    hideDomainCrawlToggle: true,
  };
}
