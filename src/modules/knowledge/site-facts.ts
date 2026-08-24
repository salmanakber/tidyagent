import type { KnowledgeContentType } from "@prisma/client";
import { detectWixCapabilities, type DetectedCapabilities } from "@/modules/wix/capabilities";
import { capabilitiesForSite } from "@/modules/platforms/capabilities";
import { isWixPlatform } from "@/modules/platforms/types";
import { wizardCopyForPlatform } from "@/modules/platforms/copy";

export type SiteFacts = DetectedCapabilities & {
  contentTypes: KnowledgeContentType[];
  toolsPresent: DetectedCapabilities["tools"];
};

export function siteFactsFromApps(
  installedWixApps: unknown,
  knowledgeCounts?: Partial<Record<"pages" | "products" | "faqs" | "policies" | "custom", number>>,
): SiteFacts {
  const apps = Array.isArray(installedWixApps) ? installedWixApps.map(String) : [];
  const detected = detectWixCapabilities(apps);
  const contentTypes: KnowledgeContentType[] = ["PAGE", "CUSTOM"];
  contentTypes.push("FAQ", "POLICY");
  if (detected.hasStores) contentTypes.push("PRODUCT");

  return {
    ...detected,
    contentTypes: Array.from(new Set(contentTypes)),
    toolsPresent: detected.tools.filter((tool) => tool.available),
  };
}

/** Wix still uses installed apps. Other platforms use their own capabilities JSON. */
export function siteFactsForSite(input: {
  platform?: string | null;
  installedWixApps?: unknown;
  capabilities?: unknown;
}): SiteFacts {
  if (isWixPlatform(input.platform)) {
    return siteFactsFromApps(input.installedWixApps);
  }
  const detected = capabilitiesForSite(input);
  const contentTypes: KnowledgeContentType[] = ["PAGE", "CUSTOM", "FAQ", "POLICY"];
  if (detected.hasStores) contentTypes.push("PRODUCT");
  return {
    ...detected,
    contentTypes: Array.from(new Set(contentTypes)),
    toolsPresent: detected.tools.filter((tool) => tool.available),
  };
}

export function knowledgeCardsForSite(input: {
  hasStores: boolean;
  hasBookings: boolean;
  pages: number;
  products: number;
  faqs: number;
  policies: number;
  custom: number;
  facts?: number;
  conflicts?: number;
  platform?: string | null;
}) {
  const cards: { label: string; value: number; hint: string }[] = [
    { label: "Website", value: input.pages, hint: "pages actually crawled" },
  ];
  if (input.hasStores) {
    cards.push({
      label: "Products",
      value: input.products,
      hint: wizardCopyForPlatform(input.platform).storeHint,
    });
  }
  if (input.faqs > 0) cards.push({ label: "FAQs", value: input.faqs, hint: "from the live site" });
  if (input.policies > 0) cards.push({ label: "Policies", value: input.policies, hint: "from the live site" });
  cards.push({ label: "Facts", value: input.facts ?? 0, hint: "structured business facts" });
  if ((input.conflicts ?? 0) > 0) cards.push({ label: "Conflicts", value: input.conflicts ?? 0, hint: "need a human choice" });
  cards.push({ label: "Custom notes", value: input.custom, hint: "added by you" });
  return cards;
}
