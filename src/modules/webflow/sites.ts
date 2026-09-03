export type WebflowSiteRecord = {
  id: string;
  displayName?: string;
  shortName?: string;
  /** Screenshot image URL from Webflow — not a live site URL. */
  previewUrl?: string;
  lastPublished?: string | null;
  customDomains?: { url?: string; id?: string }[];
};

function asHttpsUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      if (host === "screenshots.webflow.com" || host.endsWith(".png") || parsed.pathname.toLowerCase().endsWith(".png")) {
        return undefined;
      }
      return raw;
    } catch {
      return undefined;
    }
  }
  if (raw.includes("screenshots.webflow.com") || raw.toLowerCase().endsWith(".png")) return undefined;
  return `https://${raw}`;
}

/** Drop stored screenshot URLs from older installs. */
export function coerceWebflowPublicUrl(value?: string | null) {
  return asHttpsUrl(value) ?? null;
}

/** Live site URL for onboarding / knowledge. Never uses Webflow screenshot previewUrl. */
export function sitePublicUrl(site: WebflowSiteRecord) {
  for (const domain of site.customDomains ?? []) {
    const url = asHttpsUrl(domain.url);
    if (url) return url;
  }
  if (site.shortName) return `https://${site.shortName}.webflow.io`;
  return undefined;
}

export function pickWebflowSite(sites: WebflowSiteRecord[], preferredId?: string | null) {
  if (!sites.length) return null;
  if (preferredId) {
    const match = sites.find((site) => site.id === preferredId);
    if (match) return match;
  }
  if (sites.length === 1) return sites[0];
  const ranked = [...sites].sort((a, b) => {
    const aTime = a.lastPublished ? Date.parse(a.lastPublished) : 0;
    const bTime = b.lastPublished ? Date.parse(b.lastPublished) : 0;
    return bTime - aTime;
  });
  return ranked.find((site) => site.customDomains?.length) ?? ranked[0] ?? null;
}
