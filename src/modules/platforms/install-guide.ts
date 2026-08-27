import { WEBFLOW_OAUTH_SCOPES } from "@/modules/webflow/scopes";
import { SHOPIFY_OAUTH_SCOPES } from "@/modules/shopify/scopes";

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
  "sites:write": "Keep the site connection and tidyAgent site settings in sync after install.",
  "pages:read": "Read pages so the AI can learn your published content.",
  "pages:write": "Support site setup flows that Webflow requires alongside custom code and page access.",
  "custom_code:read": "See whether the chat widget script is already applied on the site.",
  "custom_code:write": "Inject the tidyAgent chat widget as site-wide custom code (you still publish for visitors to see it).",
  "cms:read": "Read CMS collections and items for knowledge (plan-scoped).",
  "ecommerce:read": "Read ecommerce catalog data when your site has a store (plan-scoped).",
};

const SHOPIFY_WHY: Record<(typeof SHOPIFY_OAUTH_SCOPES)[number], string> = {
  read_products: "Learn product titles, prices, and catalog details so the chat can answer shoppers accurately.",
  read_orders: "Support order-related questions when the AI needs order context from your store.",
  read_customers: "Support customer-related help and Shopify privacy webhook obligations for your store.",
  read_content: "Read Online Store pages and content the scanner uses for knowledge.",
  read_themes: "Understand theme/script placement so the widget can be installed safely.",
  read_script_tags: "Detect an existing tidyAgent script tag before adding or updating it.",
  write_script_tags: "Install the chat widget script on the storefront.",
  read_locales: "Respect store languages and markets when answering visitors.",
};

export const WEBFLOW_INSTALL_GUIDE: InstallGuide = {
  id: "webflow",
  name: "Webflow",
  summary:
    "Install tidyAgent from the Webflow Marketplace or Designer, approve Data Client permissions, then load knowledge through official Webflow Data APIs (not a domain crawl) and publish so the chat widget appears.",
  startHref: "/webflow",
  startLabel: "Connect Webflow",
  steps: [
    "Open tidyAgent from the Webflow Marketplace listing, or launch the Designer Extension on your site.",
    "Sign in to Webflow if prompted, then approve the tidyAgent permission screen (scopes listed below).",
    "You land in the hosted tidyAgent dashboard for that site — complete onboarding and run a knowledge scan via Webflow Data APIs.",
    "Publish the Webflow site so custom code (the chat widget) goes live for visitors.",
    "Optional: pick a plan in tidyAgent billing (card checkout). Review / testing mode may unlock Pro without checkout.",
  ],
  afterInstall: [
    "Full user guide: https://agent.tidyflowapp.com/docs/webflow",
    "Reopen tidyAgent anytime from the Designer Extension or https://agent.tidyflowapp.com/webflow.",
    "Widget look and agent settings live in the tidyAgent dashboard (AI Agent), not in Webflow Designer styles.",
    "Uninstall from Webflow when you want to revoke access; remove the tidyAgent Custom Code snippet if it remains, then publish. We delete or anonymize workspace data after a reasonable period.",
  ],
  permissions: WEBFLOW_OAUTH_SCOPES.map((scope) => ({
    scope,
    why:
      scope === "pages:read"
        ? "Read page metadata through the Webflow Pages API so knowledge comes from official APIs (not a domain crawl)."
        : WEBFLOW_WHY[scope],
  })),
  notes: [
    "tidyAgent is hosted at agent.tidyflowapp.com — Webflow is not the operator of the dashboard or AI.",
    "Knowledge uses Webflow Data APIs only. tidyAgent does not crawl or scrape the published domain.",
    "Custom code inject does not auto-publish; visitors see the bubble only after you publish.",
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
    "Script tags require write_script_tags; we do not edit your theme Liquid files by default.",
    "Terms for this listing: /terms?platform=shopify — Privacy: /privacy?platform=shopify.",
  ],
};

export const INSTALL_GUIDES = [WEBFLOW_INSTALL_GUIDE, SHOPIFY_INSTALL_GUIDE] as const;

export function installGuideFor(platform?: string | null) {
  const key = platform?.trim().toLowerCase();
  if (key === "shopify") return SHOPIFY_INSTALL_GUIDE;
  if (key === "webflow" || key === "wf") return WEBFLOW_INSTALL_GUIDE;
  return null;
}
