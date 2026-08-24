import { isWixPlatform, platformLabel, type SitePlatform } from "@/modules/platforms/types";

/** Rewrite Wix-specific product copy so a Webflow or Shopify tenant never sees another marketplace. */
export function copyForPlatform(platform: SitePlatform | string | null | undefined, text: string) {
  if (isWixPlatform(platform)) return text;
  const name = platformLabel(platform);
  return text
    .replace(/\bWix Stores catalog\b/gi, "store catalog")
    .replace(/\bWix Stores\b/gi, "store catalog")
    .replace(/\bWix site\b/gi, `${name} site`)
    .replace(/\bon a Wix site\b/gi, `on a ${name} site`)
    .replace(/\bWix App Market\b/gi, name)
    .replace(/\bWix\b/g, name);
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
    };
  }
  const name = platformLabel(platform);
  if (platform === "SHOPIFY") {
    return {
      connected: (siteName: string, planLabel: string) =>
        `${siteName} is identified through Shopify. The next step is a real read of the live store — scoped to ${planLabel} — so the employee learns this business, not a generic script.`,
      autoInstall: "Adds the widget to the storefront with a Shopify script tag.",
      manualInstall: "Place the widget only where you want it in the Shopify theme editor.",
      scanStages: [
        "Confirming the Shopify store",
        "Reading every public page",
        "Loading the product catalog",
        "Writing a business understanding",
      ],
      noUrl: "No public URL yet — publish the Shopify store, then scan.",
      crawlHint: "Sitemap, on-site links, and store catalog data. Uncheck to read only common pages like pricing, services, and FAQ.",
      storeHint: "from the store catalog",
    };
  }
  return {
    connected: (siteName: string, planLabel: string) =>
      `${siteName} is identified through ${name}. The next step is a real read of the live site — scoped to ${planLabel} — so the employee learns this business, not a generic script.`,
    autoInstall: "Adds the widget through Webflow custom code. Publish the site so visitors can see it.",
    manualInstall: "We'll still inject site-wide custom code. Choose this only if you will place the snippet yourself.",
    scanStages: [
      "Confirming the Webflow site",
      "Reading every public page",
      "Looking for catalog or CMS data",
      "Writing a business understanding",
    ],
    noUrl: "No public URL yet — publish the Webflow site, then scan.",
    crawlHint: "Sitemap, on-site links, and Webflow pages. Uncheck to read only common pages like pricing, services, and FAQ.",
    storeHint: "from the store catalog",
  };
}
