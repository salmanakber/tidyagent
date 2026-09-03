import { WEBFLOW_OAUTH_SCOPES } from "@/modules/webflow/scopes";
import { SHOPIFY_OAUTH_SCOPES } from "@/modules/shopify/scopes";
import { legalHref, shopifyDocsPath } from "@/modules/legal/platform";

export type InstallPermission = {
  scope: string;
  why: string;
};

export type InstallGuide = {
  id: "webflow" | "shopify";
  name: string;
  summary: string;
  startHref: string;
  startLabel: string;
  steps: string[];
  afterInstall: string[];
  permissions: InstallPermission[];
  notes: string[];
};

const WEBFLOW_WHY: Record<(typeof WEBFLOW_OAUTH_SCOPES)[number], string> = {
  "authorized_user:read": "Identify the Webflow user who installed tidyAgent and keep the workspace tied to that account.",
  "sites:read": "Read site name, domains, locales, and connection details for the workspace.",
  "sites:write": "Required by Webflow for site-level Custom Code apply/remove during install and disconnect.",
  "pages:read": "Read page metadata (title, SEO description, published path) from GET /v2/sites/{site_id}/pages. tidyAgent does not call GET /v2/pages/{page_id}/dom.",
  "custom_code:read": "GET /v2/sites/{site_id}/registered_scripts and GET /v2/sites/{site_id}/custom_code to see whether the chat widget script is already registered or applied.",
  "custom_code:write": "POST /v2/sites/{site_id}/registered_scripts/hosted (versioned embed.js with integrityHash) and PUT /v2/sites/{site_id}/custom_code to apply or remove the chat widget.",
  "cms:read": "Read CMS collections and items for knowledge (plan-scoped).",
  "ecommerce:read": "Read ecommerce catalog data when your site has a store (plan-scoped).",
};

const SHOPIFY_WHY: Record<(typeof SHOPIFY_OAUTH_SCOPES)[number], string> = {
  read_products: "Learn product titles, prices, and catalog details so the chat can answer shoppers accurately.",
  read_orders: "Support order-related questions when the AI needs order context from your store.",
  read_customers: "Support customer-related help and Shopify privacy webhook obligations for your store.",
  read_content: "Read Online Store pages and blogs the scanner uses for knowledge.",
  read_legal_policies: "Read refund, privacy, shipping, and other store policies so the AI can answer policy questions accurately.",
  read_themes: "Understand theme/script placement so the widget can be installed safely.",
  read_script_tags: "Detect an existing tidyAgent script tag before adding or updating it.",
  write_script_tags: "Install the chat widget script on the storefront.",
  read_locales: "Respect store languages and markets when answering visitors.",
};

export const WEBFLOW_INSTALL_GUIDE: InstallGuide = {
  id: "webflow",
  name: "Webflow",
  summary:
    "Install tidyAgent from the Webflow Marketplace, approve Data Client permissions, then load knowledge through official Webflow Data APIs (not a domain crawl) and publish so the chat widget appears.",
  startHref: "/webflow",
  startLabel: "Connect Webflow",
  steps: [
    "Open tidyAgent from the Webflow Marketplace listing and install it on your site.",
    "Sign in to Webflow if prompted, then approve the tidyAgent Data Client permission screen (scopes listed below).",
    "You land in the hosted tidyAgent dashboard for that site — complete onboarding and run a knowledge scan via Webflow Data APIs.",
    "Publish the Webflow site so custom code (the chat widget) goes live for visitors.",
    "Optional: pick a plan in tidyAgent billing (card checkout). Review / testing mode may unlock Pro without checkout.",
  ],
  afterInstall: [
    "Uninstall from tidyAgent Settings → Uninstall & remove widget. The App deletes its applied Custom Code via the Webflow API, then prompts you to Publish so the live bubble disappears. You do not need to manually edit Custom Code when uninstall succeeds.",
    "Reopen tidyAgent anytime from the Webflow Marketplace or https://agent.tidyflowapp.com/webflow.",
    "Widget look and agent settings live in the tidyAgent dashboard (AI Agent), not in Webflow site styles.",
    "Full user guide: https://agent.tidyflowapp.com/docs/webflow",
  ],
  permissions: WEBFLOW_OAUTH_SCOPES.map((scope) => ({
    scope,
    why: WEBFLOW_WHY[scope],
  })),
  notes: [
    "tidyAgent is hosted at agent.tidyflowapp.com — Webflow is not the operator of the dashboard or AI.",
    "Knowledge uses Webflow Data APIs only: site profile, page metadata (not page DOM), CMS, and ecommerce when available. tidyAgent does not crawl or scrape the published domain.",
    "Custom code registers the production executable https://agent.tidyflowapp.com/widget/embed.js as a versioned hosted script with a sha384 integrity hash (no nested remote loaders). Publish is required for visitors to see the bubble.",
    "Exact scope mapping: https://agent.tidyflowapp.com/docs/webflow and webflow-extension/SCOPE_MAPPING.md",
    "User guide: /docs/webflow — Terms: /terms?platform=webflow — Privacy: /privacy?platform=webflow.",
  ],
};

export const SHOPIFY_INSTALL_GUIDE: InstallGuide = {
  id: "shopify",
  name: "Shopify",
  summary:
    "Install tidyAgent from the Shopify App Store (or open the app with your shop domain), approve Admin API scopes, then finish onboarding so the storefront widget can load.",
  startHref: "",
  startLabel: "",
  steps: [
    "Install tidyAgent from the Shopify App Store, or open the app from Shopify Admin → Apps for your shop.",
    "Approve the Admin API permissions Shopify shows (scopes listed below).",
    "You land in the hosted tidyAgent dashboard for that shop — complete onboarding and run a knowledge scan.",
    "Confirm the chat widget script tag is present; publish/update the theme if your storefront does not show the bubble yet.",
    "Choose a plan through Shopify Billing when prompted (charges appear on your Shopify invoice).",
  ],
  afterInstall: [
    `Full user guide: https://agent.tidyflowapp.com${shopifyDocsPath()}`,
    "Reopen tidyAgent from Shopify Admin → Apps, or https://agent.tidyflowapp.com/shopify?shop=your-store.myshopify.com.",
    "Billing, trial, and cancellation stay in Shopify; tidyAgent only enforces plan limits after Shopify reports the subscription.",
    "Shopify mandatory privacy webhooks (customers/data_request, customers/redact, shop/redact) are handled at /api/shopify/webhooks.",
  ],
  permissions: SHOPIFY_OAUTH_SCOPES.map((scope) => ({
    scope,
    why: SHOPIFY_WHY[scope],
  })),
  notes: [
    "tidyAgent is hosted at agent.tidyflowapp.com — Shopify is not the operator of the dashboard or AI.",
    "Knowledge uses Shopify Admin APIs only. tidyAgent does not crawl or scrape your storefront.",
    "Script tags require write_script_tags; we do not edit your theme Liquid files by default.",
    `User guide: ${shopifyDocsPath()} — Terms: ${legalHref("/terms", "SHOPIFY")} — Privacy: ${legalHref("/privacy", "SHOPIFY")}.`,
  ],
};

export const INSTALL_GUIDES = [WEBFLOW_INSTALL_GUIDE, SHOPIFY_INSTALL_GUIDE] as const;

export function installGuideFor(platform?: string | null) {
  const key = platform?.trim().toLowerCase();
  if (key === "shopify") return SHOPIFY_INSTALL_GUIDE;
  if (key === "webflow" || key === "wf") return WEBFLOW_INSTALL_GUIDE;
  return null;
}
