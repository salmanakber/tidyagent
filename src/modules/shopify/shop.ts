const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShopifyShop(value?: string | null) {
  if (!value) return null;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0];
  if (!host || !SHOP_RE.test(host)) return null;
  return host;
}

export function shopPublicUrl(shop: string, myshopifyDomain?: string | null, primaryDomain?: string | null) {
  const custom = primaryDomain?.trim();
  if (custom) return custom.includes("://") ? custom : `https://${custom}`;
  const domain = myshopifyDomain || shop;
  return `https://${domain}`;
}
