/**
 * Shopify adapter — placeholder for the marketplace after Webflow.
 * Do not call from Wix or Webflow paths.
 */
export const SHOPIFY_ADAPTER = {
  key: "SHOPIFY" as const,
  name: "Shopify",
  status: "planned" as const,
};

export function provisionShopifyTenant(): never {
  throw new Error("Shopify provisioning is not implemented yet");
}
