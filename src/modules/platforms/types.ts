export const SITE_PLATFORMS = ["WIX", "WEBFLOW", "SHOPIFY"] as const;

export type SitePlatform = (typeof SITE_PLATFORMS)[number];

export const PLATFORM_LABELS: Record<SitePlatform, string> = {
  WIX: "Wix",
  WEBFLOW: "Webflow",
  SHOPIFY: "Shopify",
};

/** Reserved prefixes so Webflow/Shopify ids never collide with real Wix instance ids. */
export const PLATFORM_INSTANCE_PREFIX = {
  WEBFLOW: "wf:",
  SHOPIFY: "shopify:",
} as const;

export function isSitePlatform(value: unknown): value is SitePlatform {
  return value === "WIX" || value === "WEBFLOW" || value === "SHOPIFY";
}

/**
 * Missing/legacy values are Wix. Existing production cookies and rows must keep
 * the current Wix behavior.
 */
export function isWixPlatform(platform?: string | null): boolean {
  return !platform || platform === "WIX";
}

export function isWebflowPlatform(platform?: string | null): boolean {
  return platform === "WEBFLOW";
}

export function isShopifyPlatform(platform?: string | null): boolean {
  return platform === "SHOPIFY";
}

export function platformLabel(platform?: string | null): string {
  if (isSitePlatform(platform)) return PLATFORM_LABELS[platform];
  return PLATFORM_LABELS.WIX;
}

export function resolveSitePlatform(platform?: string | null): SitePlatform {
  return isSitePlatform(platform) ? platform : "WIX";
}

export function syntheticInstanceId(platform: "WEBFLOW" | "SHOPIFY", externalId: string) {
  return `${PLATFORM_INSTANCE_PREFIX[platform]}${externalId}`;
}

/** True when this instance id may be sent to Wix embed / BI / App APIs. */
export function isWixInstanceTarget(instanceId?: string | null): boolean {
  if (!instanceId) return false;
  if (instanceId.startsWith(PLATFORM_INSTANCE_PREFIX.WEBFLOW)) return false;
  if (instanceId.startsWith(PLATFORM_INSTANCE_PREFIX.SHOPIFY)) return false;
  return true;
}
