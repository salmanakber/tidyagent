import { isWixPlatform, platformLabel, type SitePlatform } from "@/modules/platforms/types";

/** Rewrite Wix-specific product copy so a Webflow or Shopify tenant never sees another marketplace. */
export function copyForPlatform(platform: SitePlatform | string | null | undefined, text: string) {
  if (isWixPlatform(platform)) return text;
  const name = platformLabel(platform);
  return text
    .replace(/\bWix Stores catalog\b/gi, "store catalog")
    .replace(/\bWix Stores\b/gi, "store catalog")
    .replace(/\bWix site\b/gi, `${name} site`)
    .replace(/\bon a Wix site\b/gi, `on a ${name} site`)
    .replace(/\bWix App Market\b/gi, name)
    .replace(/\bWix\b/g, name);
}

export function bulletsForPlatform(platform: SitePlatform | string | null | undefined, bullets: string[]) {
  return bullets.map((item) => copyForPlatform(platform, item));
}
