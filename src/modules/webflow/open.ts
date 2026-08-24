export function isWebflowHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "webflow.com" || host.endsWith(".webflow.com") || host.endsWith(".webflow.io");
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
