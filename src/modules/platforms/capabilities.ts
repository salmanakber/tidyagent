import { detectWixCapabilities, type DetectedCapabilities, type SiteCapability } from "@/modules/wix/capabilities";
import { isShopifyPlatform, isWixPlatform } from "@/modules/platforms/types";

function flagsFromCapabilities(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { hasStores: false, hasBookings: false, hasEvents: false, hasBlog: false };
  }
  const row = value as Record<string, unknown>;
  return {
    hasStores: Boolean(row.hasStores),
    hasBookings: Boolean(row.hasBookings),
    hasEvents: Boolean(row.hasEvents),
    hasBlog: Boolean(row.hasBlog),
  };
}

/**
 * Wix keeps detectWixCapabilities(installed apps). Webflow/Shopify use site.capabilities
 * JSON from their own provision path — never Wix app lists.
 */
export function capabilitiesForSite(input: {
  platform?: string | null;
  installedWixApps?: unknown;
  capabilities?: unknown;
}): DetectedCapabilities {
  if (isWixPlatform(input.platform)) {
    const apps = Array.isArray(input.installedWixApps) ? input.installedWixApps.map(String) : [];
    return detectWixCapabilities(apps);
  }

  const flags = flagsFromCapabilities(input.capabilities);
  const hasStores = isShopifyPlatform(input.platform) ? true : flags.hasStores;
  const tools: SiteCapability[] = [
    { key: "website_content", label: "Website content", available: true, source: "content" },
    { key: "products", label: "Products", available: hasStores, source: "content" },
    { key: "product_search", label: "Product search", available: hasStores, source: "content" },
    { key: "cart", label: "Cart", available: hasStores, source: "content" },
    { key: "orders", label: "Orders", available: hasStores, source: "content" },
    { key: "customer_data", label: "Customer data", available: false, source: "content" },
    { key: "bookings", label: "Bookings", available: flags.hasBookings, source: "content" },
    { key: "events", label: "Events", available: flags.hasEvents, source: "content" },
    { key: "blog", label: "Blog", available: flags.hasBlog, source: "content" },
  ];

  return {
    hasWebsiteContent: true,
    hasStores,
    hasBookings: flags.hasBookings,
    hasEvents: flags.hasEvents,
    hasBlog: flags.hasBlog,
    tools,
  };
}
