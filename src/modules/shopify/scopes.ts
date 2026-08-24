/** Scopes requested on /shopify/install. Must match the Partner Dashboard grant. */
export const SHOPIFY_OAUTH_SCOPES = [
  "read_products",
  "read_orders",
  "read_customers",
  "read_content",
  "read_themes",
  "read_script_tags",
  "write_script_tags",
  "read_locales",
] as const;

export const SHOPIFY_SCOPE_STRING = SHOPIFY_OAUTH_SCOPES.join(",");
