/**
 * Webflow adapter — planned, not wired in production.
 * Do not call from Wix install, billing, embed, or scan paths.
 */
export const WEBFLOW_ADAPTER = {
  key: "WEBFLOW" as const,
  name: "Webflow",
  status: "planned" as const,
};

export function provisionWebflowTenant(): never {
  throw new Error("Webflow provisioning is not implemented yet");
}
