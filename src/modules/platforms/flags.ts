import type { SitePlatform } from "@/modules/platforms/types";
import { isWixPlatform } from "@/modules/platforms/types";

/**
 * Sync check used by unit tests and Wix-safe defaults.
 * Live Webflow/Shopify on/off lives in Admin → Settings (see marketplace.ts).
 */
export function isPlatformAdapterEnabled(platform?: string | null): boolean {
  if (isWixPlatform(platform)) return true;
  if (platform === "WEBFLOW") return process.env.WEBFLOW_ENABLED === "true";
  if (platform === "SHOPIFY") return process.env.SHOPIFY_ENABLED === "true";
  return false;
}

export function assertPlatformAdapterEnabled(platform: SitePlatform) {
  if (isPlatformAdapterEnabled(platform)) return;
  throw new Error(`${platform} adapter is not enabled. Turn it on in Admin → Settings.`);
}
