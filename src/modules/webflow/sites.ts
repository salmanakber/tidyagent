export type WebflowSiteRecord = {
  id: string;
  displayName?: string;
  shortName?: string;
  previewUrl?: string;
  lastPublished?: string | null;
  customDomains?: { url?: string; id?: string }[];
};

export function sitePublicUrl(site: WebflowSiteRecord) {
  const custom = site.customDomains?.[0]?.url?.trim();
  if (custom) return custom.includes("://") ? custom : `https://${custom}`;
  if (site.previewUrl) return site.previewUrl;
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

export function widgetInlineSource(widgetSrc: string, instanceId: string) {
  return `(function(){if(window.__tidyAgentWebflow)return;window.__tidyAgentWebflow=1;var s=document.createElement("script");s.src=${JSON.stringify(widgetSrc)};s.async=true;s.setAttribute("data-instance",${JSON.stringify(instanceId)}); (document.body||document.documentElement).appendChild(s);})();`;
}
