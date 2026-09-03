export function isWebflowHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "webflow.com" || host.endsWith(".webflow.com") || host.endsWith(".webflow.io");
}

/** Embedded / Marketplace open hosts are often CloudFront / Webflow CDN, not *.webflow.com. */
export function isWebflowExtensionHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host.endsWith(".cloudfront.net") ||
    host.endsWith(".webflowusercontent.com") ||
    host.endsWith(".design-extensions.webflow.io") ||
    host.includes("design-extension")
  );
}

/**
 * True when /webflow is inside Designer / Launch iframe.
 * Never start OAuth inside that iframe — Webflow's authorize page refuses to be framed.
 *
 * Top-level navigations (sec-fetch-dest=document), including “Continue in a new tab”,
 * must NOT be treated as embedded just because Referer is Webflow — otherwise OAuth never starts.
 */
export function isEmbeddedWebflowRequest(input: {
  embed?: string | null;
  dest?: string | null;
  site?: string | null;
  referer?: string | null;
  /** Explicit “opened as popup / new tab for OAuth” — always top-level. */
  popup?: string | null;
}) {
  if (input.popup === "1" || input.popup === "true") return false;
  if (input.embed === "1" || input.embed === "true") return true;
  if (input.dest === "iframe" || input.dest === "embed") return true;
  // Full-page / new-tab navigation — allow OAuth even when Referer is Webflow.
  if (input.dest === "document") return false;

  if (input.referer) {
    try {
      const host = new URL(input.referer).hostname;
      if (isWebflowHost(host) || isWebflowExtensionHost(host)) return true;
    } catch {
      /* ignore invalid referer */
    }
  }
  if (!input.dest && input.site === "cross-site") return true;
  return false;
}

/** True when Open app / Designer likely sent this browser to tidyAgent. */
export function isWebflowOpenRequest(input: {
  referer?: string | null;
  siteId?: string | null;
  site?: string | null;
}) {
  if (input.siteId?.trim() || input.site?.trim()) return true;
  if (!input.referer) return false;
  try {
    return isWebflowHost(new URL(input.referer).hostname);
  } catch {
    return false;
  }
}

export function webflowCallbackQuery(params: {
  code?: string;
  state?: string;
  siteId?: string;
  site?: string;
  error?: string;
  error_description?: string;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `/api/webflow/oauth/callback?${encoded}` : "/api/webflow/oauth/callback";
}
