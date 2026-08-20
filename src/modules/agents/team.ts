import type { AgentSpecialty, KnowledgeContentType, PlanKey } from "@prisma/client";

export const WIDGET_TEMPLATES = [
  {
    key: "CLASSIC" as const,
    label: "Classic",
    note: "Rounded card above the launcher — the default look.",
  },
  {
    key: "SOFT" as const,
    label: "Soft",
    note: "Larger corners and a calmer header. Good for lifestyle brands.",
  },
  {
    key: "BAR" as const,
    label: "Bar",
    note: "Full-width bottom sheet on mobile; compact card on desktop.",
  },
  {
    key: "MINIMAL" as const,
    label: "Minimal",
    note: "Launcher only until opened. No greeting bubble on the page.",
  },
];

export const SPECIALTIES: {
  key: AgentSpecialty;
  label: string;
  blurb: string;
  defaultScopes: KnowledgeContentType[];
  needs: "stores" | "bookings" | null;
}[] = [
  {
    key: "GENERAL",
    label: "General",
    blurb: "Parent greeter. Answers site, hours, and policy questions, then hands off specialists.",
    defaultScopes: ["PAGE", "FAQ", "POLICY", "CUSTOM"],
    needs: null,
  },
  {
    key: "ECOMMERCE",
    label: "Store & products",
    blurb: "Catalog, prices, shipping, orders, and returns — only if this site has Wix Stores.",
    defaultScopes: ["PRODUCT", "PAGE", "POLICY", "CUSTOM"],
    needs: "stores",
  },
  {
    key: "SUPPORT",
    label: "Support",
    blurb: "FAQs, policies, complaints, and when to escalate to a human.",
    defaultScopes: ["FAQ", "POLICY", "PAGE", "CUSTOM"],
    needs: null,
  },
  {
    key: "BOOKINGS",
    label: "Bookings",
    blurb: "Appointments and availability — only if this site has Wix Bookings.",
    defaultScopes: ["PAGE", "CUSTOM"],
    needs: "bookings",
  },
  {
    key: "CONTENT",
    label: "Pages & content",
    blurb: "About, blog, services, and everything crawled from public pages.",
    defaultScopes: ["PAGE", "FAQ", "CUSTOM"],
    needs: null,
  },
];

export function maxAgentsForPlan(planKey: PlanKey) {
  if (planKey === "PRO") return 8;
  if (planKey === "GROWTH") return 4;
  return 1;
}

export function classifyVisitorIntent(text: string): AgentSpecialty {
  const value = text.toLowerCase();
  if (
    /\b(product|products|price|pricing|sku|cart|checkout|order|orders|shipping|delivery|stock|in stock|size|colour|color|buy|purchase|discount|coupon|return|refund|warranty)\b/.test(
      value,
    )
  ) {
    return "ECOMMERCE";
  }
  if (/\b(book|booking|bookings|appointment|reserve|reservation|schedule|availability|slot)\b/.test(value)) {
    return "BOOKINGS";
  }
  if (/\b(help|support|complaint|broken|damaged|issue|problem|not working|cancel)\b/.test(value)) {
    return "SUPPORT";
  }
  if (/\b(blog|article|about|story|team|page)\b/.test(value)) {
    return "CONTENT";
  }
  return "GENERAL";
}

export function pickAgentForIntent<T extends { isPrimary: boolean; specialty: AgentSpecialty; status?: string }>(
  agents: T[],
  intent: AgentSpecialty,
) {
  const live = agents.filter((agent) => !agent.status || agent.status === "ACTIVE" || agent.status === "DRAFT");
  const specialist = live.find((agent) => agent.specialty === intent && intent !== "GENERAL");
  if (specialist) return specialist;
  return live.find((agent) => agent.isPrimary || agent.specialty === "GENERAL") ?? live[0] ?? null;
}

export function scopesForSpecialty(
  specialty: AgentSpecialty,
  available: KnowledgeContentType[],
): KnowledgeContentType[] {
  const preset = SPECIALTIES.find((item) => item.key === specialty)?.defaultScopes ?? ["PAGE", "CUSTOM"];
  const allowed = new Set(available);
  const next = preset.filter((scope) => allowed.has(scope));
  return next.length ? next : available.includes("PAGE") ? ["PAGE"] : available.slice(0, 1);
}
