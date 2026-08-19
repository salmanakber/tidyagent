export type SiteCapability = {
  key: string;
  label: string;
  available: boolean;
  source: "wix-app" | "content" | "manual";
};

export type DetectedCapabilities = {
  hasWebsiteContent: boolean;
  hasStores: boolean;
  hasBookings: boolean;
  hasEvents: boolean;
  hasBlog: boolean;
  tools: SiteCapability[];
};

const STORE_APPS = ["stores", "wix stores", "ecom", "stores-wix"];
const BOOKING_APPS = ["bookings", "wix bookings", "wix-bookings"];
const EVENT_APPS = ["events", "wix events"];
const BLOG_APPS = ["blog", "wix blog"];

function includesApp(installed: string[], needles: string[]) {
  return installed.some((app) =>
    needles.some((needle) => app.toLowerCase().includes(needle)),
  );
}

/**
 * Detect which Wix capabilities a site actually has.
 * The agent must only expose tools that are available and authorized.
 */
export function detectWixCapabilities(installedWixApps: string[]): DetectedCapabilities {
  const hasStores = includesApp(installedWixApps, STORE_APPS);
  const hasBookings = includesApp(installedWixApps, BOOKING_APPS);
  const hasEvents = includesApp(installedWixApps, EVENT_APPS);
  const hasBlog = includesApp(installedWixApps, BLOG_APPS);

  const tools: SiteCapability[] = [
    { key: "website_content", label: "Website content", available: true, source: "content" },
    { key: "products", label: "Products", available: hasStores, source: "wix-app" },
    { key: "product_search", label: "Product search", available: hasStores, source: "wix-app" },
    { key: "cart", label: "Cart", available: hasStores, source: "wix-app" },
    { key: "orders", label: "Orders", available: hasStores, source: "wix-app" },
    { key: "customer_data", label: "Customer data", available: true, source: "wix-app" },
    { key: "bookings", label: "Bookings", available: hasBookings, source: "wix-app" },
    { key: "events", label: "Events", available: hasEvents, source: "wix-app" },
    { key: "blog", label: "Blog", available: hasBlog, source: "content" },
  ];

  return {
    hasWebsiteContent: true,
    hasStores,
    hasBookings,
    hasEvents,
    hasBlog,
    tools,
  };
}

/** Phase 1/5: prove ecommerce end-to-end before generalizing verticals. */
export const ECOMMERCE_CAPABILITY_KEYS = [
  "customer_questions",
  "product_recommendations",
  "product_search",
  "cart_assistance",
  "order_tracking",
  "returns_support",
  "lead_capture",
  "support",
  "human_escalation",
] as const;

export const DEFAULT_BUSINESS_RULES = [
  { key: "never_invent_prices", description: "Never invent prices." },
  { key: "never_invent_availability", description: "Never invent availability." },
  { key: "never_invent_services", description: "Never invent services." },
  { key: "never_promise_unsupported", description: "Never promise unsupported outcomes." },
  { key: "never_policy_exceptions", description: "Never make policy exceptions." },
  { key: "ask_before_actions", description: "Ask before important actions." },
  { key: "escalate_complaints", description: "Escalate complaints." },
  { key: "escalate_when_unknown", description: "Escalate when reliable information is unavailable." },
] as const;

export const DEFAULT_TOOL_PERMISSIONS: { toolKey: string; mode: "DISABLED" | "ALLOWED" | "CONFIRM" }[] = [
  { toolKey: "searchProducts", mode: "ALLOWED" },
  { toolKey: "getProduct", mode: "ALLOWED" },
  { toolKey: "compareProducts", mode: "ALLOWED" },
  { toolKey: "getCart", mode: "ALLOWED" },
  { toolKey: "addToCart", mode: "CONFIRM" },
  { toolKey: "removeFromCart", mode: "CONFIRM" },
  { toolKey: "getOrder", mode: "ALLOWED" },
  { toolKey: "getCustomer", mode: "ALLOWED" },
  { toolKey: "createLead", mode: "CONFIRM" },
  { toolKey: "handoffToHuman", mode: "ALLOWED" },
  { toolKey: "notifyBusinessOwner", mode: "ALLOWED" },
];
