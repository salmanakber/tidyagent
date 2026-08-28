export function isShopifyHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "admin.shopify.com" ||
    host.endsWith(".myshopify.com") ||
    host === "shopify.com" ||
    host.endsWith(".shopify.com")
  );
}

export function isShopifyOpenRequest(input: {
  referer?: string | null;
  shop?: string | null;
  hmac?: string | null;
}) {
  if (input.shop?.trim() || input.hmac?.trim()) return true;
  if (!input.referer) return false;
  try {
    return isShopifyHost(new URL(input.referer).hostname);
  } catch {
    return false;
  }
}

export function shopifyReconnectPath(shop: string) {
  const normalized = shop.trim().toLowerCase();
  if (!normalized) return "/shopify";
  const domain = normalized.includes(".myshopify.com") ? normalized : `${normalized}.myshopify.com`;
  const query = new URLSearchParams({ shop: domain, embedded: "1" });
  return `/shopify?${query.toString()}`;
}

export function shopifyAppQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `/shopify?${encoded}` : "/shopify";
}

export function shopifyCallbackQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return `/api/shopify/oauth/callback?${query.toString()}`;
}

/** Re-enter the Shopify admin iframe after OAuth (Partner Dashboard embedded apps). */
export function shopifyEmbeddedAdminAppUrl(shop: string, apiKey: string) {
  const handle = shop.replace(/\.myshopify\.com$/i, "").toLowerCase();
  if (!handle || !apiKey) return null;
  return `https://admin.shopify.com/store/${handle}/apps/${encodeURIComponent(apiKey)}`;
}
