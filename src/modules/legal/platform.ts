import {
  isSitePlatform,
  platformLabel,
  type SitePlatform,
} from "@/modules/platforms/types";

/** URL slug for Shopify listing pages (Partner Dashboard forbids "shopify" in public URLs). */
export const SHOPIFY_LISTING_SLUG = "sy";

export function shopifyDocsPath() {
  return `/docs/${SHOPIFY_LISTING_SLUG}`;
}

/** Query value for /terms and /privacy when the workspace is Shopify. */
export function legalPlatformQuerySlug(platform: SitePlatform) {
  if (platform === "WIX") return null;
  if (platform === "SHOPIFY") return SHOPIFY_LISTING_SLUG;
  return platform.toLowerCase();
}

/** Marketplace / install surface name for legal copy. */
export function legalMarketplace(platform: SitePlatform) {
  if (platform === "WEBFLOW") return "Webflow Marketplace";
  if (platform === "SHOPIFY") return "Shopify App Store";
  return "Wix App Market";
}

export function legalSiteNoun(platform: SitePlatform) {
  if (platform === "SHOPIFY") return "store";
  return "site";
}

export function legalOpenSurface(platform: SitePlatform) {
  if (platform === "WEBFLOW") return "Webflow Designer";
  if (platform === "SHOPIFY") return "Shopify Admin";
  return "Wix dashboard";
}

export function legalBillingBlurb(platform: SitePlatform) {
  if (platform === "WEBFLOW") {
    return {
      plans:
        "Paid features require a tidyAgent plan (Starter, Business, or Pro) purchased through card checkout on the hosted dashboard. Card payments are processed by our payment provider. Webflow is not the merchant of record for tidyAgent subscriptions.",
      enforce:
        "What each plan can do (agent count, voice, automations, knowledge depth, and similar limits) is enforced by tidyAgent after checkout succeeds. Changing or cancelling a plan is done in the tidyAgent billing portal (or your payment provider’s customer portal). Access continues until the current paid period ends when auto-renewal is turned off, unless these Terms say otherwise.",
      unpaid:
        "Widget colors, greeting text, and similar basic setup are available on paid plans and are not sold as a separate checkout. Unpaid installs can open billing only until a plan is purchased.",
      liabilityThru: "through card checkout for the affected Webflow site",
    };
  }
  if (platform === "SHOPIFY") {
    return {
      plans:
        "Paid features require a tidyAgent plan (Starter, Business, or Pro) purchased through Shopify Billing. Shopify processes payment. tidyAgent does not collect card details outside Shopify’s checkout.",
      enforce:
        "What each plan can do (agent count, voice, automations, knowledge depth, and similar limits) is enforced by tidyAgent after Shopify reports the subscription. Changing or cancelling a plan is done in Shopify. Access continues until the current paid period ends when auto-renewal is turned off, unless Shopify or these Terms say otherwise.",
      unpaid:
        "Widget colors, greeting text, and similar basic setup are available on paid plans and are not sold as a separate checkout. Unpaid installs can open billing only until a plan is purchased.",
      liabilityThru: "through Shopify for the affected store",
    };
  }
  return {
    plans:
      "Paid features require a Wix App Market plan (Starter, Business, or Pro). Wix processes payment. tidyAgent does not collect card details and does not bill through a separate checkout. A 7-day trial, if offered, is created and charged by Wix according to the listing you accept.",
    enforce:
      "What each plan can do (agent count, voice, automations, knowledge depth, and similar limits) is enforced by tidyAgent after Wix reports the purchase. Changing or cancelling a plan is done in Wix. Access continues until the current paid period ends when auto-renewal is turned off, unless Wix or these Terms say otherwise.",
    unpaid:
      "Widget colors, greeting text, and similar basic setup are available on paid plans and are not sold as a separate checkout. Unpaid installs can open billing only until a plan is purchased.",
    liabilityThru: "through Wix for the affected site",
  };
}

export function legalPrivacyControllers(platform: SitePlatform) {
  const name = platformLabel(platform);
  if (platform === "WEBFLOW") {
    return `For site-owner accounts (email, login, billing status, agent settings), tidyAgent is the controller. For visitor chat content on your live site, you are typically the controller and tidyAgent is the processor acting on your instructions to provide the Service. Webflow is a separate controller for your Webflow account and Marketplace relationship; card billing for tidyAgent is handled by our payment provider.`;
  }
  if (platform === "SHOPIFY") {
    return `For store-owner accounts (email, login, billing status, agent settings), tidyAgent is the controller. For visitor chat content on your live storefront, you are typically the controller and tidyAgent is the processor acting on your instructions to provide the Service. Shopify is a separate controller for App Store billing and the Shopify account.`;
  }
  return `For site-owner accounts (email, login, billing status, agent settings), tidyAgent is the controller. For visitor chat content on your live site, you are typically the controller and tidyAgent is the processor acting on your instructions to provide the Service. Wix is a separate controller for App Market billing and the Wix account.`;
}

export function legalPrivacySharingLine(platform: SitePlatform) {
  if (platform === "WEBFLOW") {
    return "Webflow — install, permissions, site APIs, and Marketplace distribution; our payment provider — card checkout and subscription status;";
  }
  if (platform === "SHOPIFY") {
    return "Shopify — install, permissions, Admin APIs, and App Store billing;";
  }
  return "Wix — install, permissions, site APIs, and App Market billing;";
}

export function legalHref(path: "/terms" | "/privacy", platform: SitePlatform) {
  const slug = legalPlatformQuerySlug(platform);
  if (!slug) return path;
  return `${path}?platform=${slug}`;
}

export function parseLegalPlatformParam(raw?: string | null): SitePlatform | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === "WF") return "WEBFLOW";
  if (normalized === "SY" || normalized === "SHOPIFY") return "SHOPIFY";
  return isSitePlatform(normalized) ? normalized : null;
}
