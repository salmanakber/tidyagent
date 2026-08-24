import type { SitePlatform } from "@/modules/platforms/types";
import { isWixPlatform } from "@/modules/platforms/types";

function envFlag(name: string) {
  return process.env[name] === "true";
}

export function isWebflowEnabled() {
  return envFlag("WEBFLOW_ENABLED");
}

export function isShopifyEnabled() {
  return envFlag("SHOPIFY_ENABLED");
}

export function isPlatformAdapterEnabled(platform?: string | null): boolean {
  if (isWixPlatform(platform)) return true;
  if (platform === "WEBFLOW") return isWebflowEnabled();
  if (platform === "SHOPIFY") return isShopifyEnabled();
  return false;
}

export function assertPlatformAdapterEnabled(platform: SitePlatform) {
  if (isPlatformAdapterEnabled(platform)) return;
  throw new Error(`${platform} adapter is not enabled on this server`);
}
