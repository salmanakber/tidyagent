/**
 * Webflow adapter metadata. Install lives behind Admin → Settings → Enable Webflow.
 * Wix install, billing, embed, and scan paths must not import provision from here.
 */
export const WEBFLOW_ADAPTER = {
  key: "WEBFLOW" as const,
  name: "Webflow",
  status: "live" as const,
};
