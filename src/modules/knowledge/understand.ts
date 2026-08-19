import { z } from "zod";
import { getAIProvider } from "@/modules/ai/factory";
import type { ExtractedPage } from "@/modules/knowledge/extract";
import type { SiteUnderstanding } from "@/modules/knowledge/types";

export type { SiteUnderstanding } from "@/modules/knowledge/types";

const understandingSchema = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().min(1).max(80),
  businessType: z.string().min(1).max(80),
  businessModel: z.string().min(1).max(80),
  summary: z.string().min(1).max(1200),
  audience: z.string().min(1).max(240),
  tone: z.string().min(1).max(80),
  offerings: z.array(z.string()).max(16).default([]),
  faqs: z.array(z.string()).max(12).default([]),
  policies: z.array(z.string()).max(12).default([]),
  contact: z
    .object({
      emails: z.array(z.string()).default([]),
      phones: z.array(z.string()).default([]),
      hours: z.string().optional(),
    })
    .default({ emails: [], phones: [] }),
  differentiators: z.array(z.string()).max(10).default([]),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export async function understandSite(input: {
  displayName: string;
  siteUrl: string;
  locale?: string | null;
  currency?: string | null;
  pages: ExtractedPage[];
  products: { name: string; description?: string; price?: string }[];
}): Promise<SiteUnderstanding> {
  const heuristic = heuristicUnderstanding(input);
  try {
    const ai = await getAIProvider();
    const brief = buildBrief(input);
    const result = await ai.generate({
      temperature: 0.15,
      maxTokens: 1400,
      system:
        "You are a senior business analyst preparing an AI customer-service employee. Read the extracted website evidence. Return JSON only. Never invent a vertical (no generic 'online fashion store'). If evidence is thin, say so and keep confidence low. Quote only facts present in the evidence.",
      prompt: `Site URL: ${input.siteUrl}\nWix display name: ${input.displayName}\nLocale: ${input.locale || "unknown"}\nCurrency: ${input.currency || "unknown"}\n\nEvidence:\n${brief}\n\nReturn JSON with keys: name, industry, businessType, businessModel, summary, audience, tone, offerings[], faqs[], policies[], contact{emails[],phones[],hours?}, differentiators[], confidence (high|medium|low).`,
    });
    const parsed = parseJson(result.text);
    const merged = understandingSchema.parse({
      ...heuristic,
      ...parsed,
      contact: {
        emails: unique([...(parsed.contact?.emails ?? []), ...heuristic.contact.emails]),
        phones: unique([...(parsed.contact?.phones ?? []), ...heuristic.contact.phones]),
        hours: parsed.contact?.hours || heuristic.contact.hours,
      },
      offerings: unique([...(parsed.offerings ?? []), ...heuristic.offerings]).slice(0, 16),
    });
    return merged;
  } catch {
    return heuristic;
  }
}

export function heuristicUnderstanding(input: {
  displayName: string;
  siteUrl: string;
  pages: ExtractedPage[];
  products: { name: string; description?: string; price?: string }[];
}): SiteUnderstanding {
  const home = input.pages[0];
  const emails = unique(input.pages.flatMap((page) => page.emails));
  const phones = unique(input.pages.flatMap((page) => page.phones));
  const offerings = unique([
    ...input.products.map((item) => item.name),
    ...input.pages.flatMap((page) => page.headings),
  ]).slice(0, 12);
  const faqs = input.pages
    .filter((page) => page.contentType === "FAQ")
    .flatMap((page) => page.headings)
    .slice(0, 8);
  const policies = input.pages
    .filter((page) => page.contentType === "POLICY")
    .map((page) => page.title)
    .slice(0, 8);
  const summary =
    home?.description ||
    home?.text.slice(0, 420) ||
    `${input.displayName} is connected. Core pages were read so the AI employee can speak from the live site instead of guesses.`;

  return {
    name: home?.title || input.displayName,
    industry: inferIndustry(`${home?.title ?? ""} ${home?.description ?? ""} ${offerings.join(" ")}`),
    businessType: input.products.length ? "Ecommerce / catalog" : inferType(input.pages),
    businessModel: input.products.length ? "Catalog + customer service" : "Service or content site",
    summary,
    audience: "People visiting the live website with questions before they buy or book.",
    tone: "Clear, helpful, and faithful to the site copy.",
    offerings,
    faqs,
    policies,
    contact: { emails, phones },
    differentiators: home?.headings.slice(0, 4) ?? [],
    confidence: input.pages.length >= 3 && (home?.text.length ?? 0) > 280 ? "medium" : "low",
  };
}

function buildBrief(input: {
  pages: ExtractedPage[];
  products: { name: string; description?: string; price?: string }[];
}) {
  const pages = input.pages
    .slice(0, 18)
    .map((page) => {
      return `URL: ${page.url}\nTitle: ${page.title}\nType: ${page.contentType}\nMeta: ${page.description}\nHeadings: ${page.headings.join(" | ")}\nText: ${page.text.slice(0, 1400)}`;
    })
    .join("\n---\n");
  const products = input.products
    .slice(0, 40)
    .map((item) => `- ${item.name}${item.price ? ` (${item.price})` : ""} ${item.description?.slice(0, 180) ?? ""}`)
    .join("\n");
  return `${pages}\n\nCatalog:\n${products || "(none in plan scope)"}`.slice(0, 24000);
}

function parseJson(text: string): Partial<SiteUnderstanding> & { contact?: SiteUnderstanding["contact"] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(text.slice(start, end + 1)) as Partial<SiteUnderstanding>;
  } catch {
    return {};
  }
}

function inferIndustry(text: string) {
  const hay = text.toLowerCase();
  if (/clean|maid|janitor/.test(hay)) return "Home services";
  if (/clinic|dental|health|wellness|spa/.test(hay)) return "Health & wellness";
  if (/restaurant|cafe|food|menu|cater/.test(hay)) return "Food & hospitality";
  if (/law|legal|attorney/.test(hay)) return "Professional services";
  if (/real estate|propert|realtor/.test(hay)) return "Real estate";
  if (/gym|fitness|yoga/.test(hay)) return "Fitness";
  if (/salon|beauty|hair/.test(hay)) return "Beauty";
  if (/shop|store|product|cart/.test(hay)) return "Retail";
  return "Local business";
}

function inferType(pages: ExtractedPage[]) {
  if (pages.some((page) => /book|appoint/.test(page.url.toLowerCase()))) return "Appointments / bookings";
  if (pages.some((page) => page.contentType === "SERVICE")) return "Services";
  return "Website / brochure";
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
