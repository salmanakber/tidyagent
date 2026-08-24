export function isWebflowHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "webflow.com" || host.endsWith(".webflow.com") || host.endsWith(".webflow.io");
}

/** Designer Extension unique hosts are often CloudFront / Webflow CDN, not *.webflow.com. */
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
 * True when /webflow is inside Designer / Launch. Never start OAuth in that iframe —
 * Webflow's authorize page refuses to be framed ("refused to connect").
 */
export function isEmbeddedWebflowRequest(input: {
  embed?: string | null;
  dest?: string | null;
  site?: string | null;
  referer?: string | null;
}) {
  if (input.embed === "1" || input.embed === "true") return true;
  if (input.dest === "iframe" || input.dest === "embed") return true;
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
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `/api/webflow/oauth/callback?${encoded}` : "/api/webflow/oauth/callback";
}
