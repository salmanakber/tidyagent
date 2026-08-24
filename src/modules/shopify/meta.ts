/**
 * Shopify adapter. Install is behind Admin → Settings → Enable Shopify.
 * Wix and Webflow paths must not import provision from here.
 */
export const SHOPIFY_ADAPTER = {
  key: "SHOPIFY" as const,
  name: "Shopify",
  status: "live" as const,
};
