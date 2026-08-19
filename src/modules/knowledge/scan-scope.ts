import type { PlanKey } from "@prisma/client";
import { PLAN_LABELS } from "@/modules/billing/catalog";

export type ScanScope = {
  planKey: PlanKey;
  planLabel: string;
  maxPages: number;
  maxProducts: number;
  maxCharsPerPage: number;
  maxCmsCollections: number;
  maxCmsItemsPerCollection: number;
  includeSiteProperties: boolean;
  includeCms: boolean;
  includeStores: boolean;
  includeBookings: boolean;
  includeDomainCrawl: boolean;
  depthNote: string;
};

const SCOPES: Record<PlanKey, Omit<ScanScope, "planKey" | "planLabel">> = {
  FREE: {
    maxPages: 0,
    maxProducts: 0,
    maxCharsPerPage: 0,
    maxCmsCollections: 0,
    maxCmsItemsPerCollection: 0,
    includeSiteProperties: false,
    includeCms: false,
    includeStores: false,
    includeBookings: false,
    includeDomainCrawl: false,
    depthNote: "Purchase Starter, Business, or Pro to read the site and go live.",
  },
  STARTER: {
    maxPages: 28,
    maxProducts: 0,
    maxCharsPerPage: 8000,
    maxCmsCollections: 8,
    maxCmsItemsPerCollection: 40,
    includeSiteProperties: true,
    includeCms: true,
    includeStores: false,
    includeBookings: false,
    includeDomainCrawl: true,
    depthNote: "Wix site profile, pages, CMS collections, and a domain crawl. Store catalog stays on Business and Pro.",
  },
  GROWTH: {
    maxPages: 70,
    maxProducts: 180,
    maxCharsPerPage: 10000,
    maxCmsCollections: 20,
    maxCmsItemsPerCollection: 80,
    includeSiteProperties: true,
    includeCms: true,
    includeStores: true,
    includeBookings: true,
    includeDomainCrawl: true,
    depthNote: "Site profile, pages, CMS, Wix Stores catalog, and bookings data — plus a live domain crawl.",
  },
  PRO: {
    maxPages: 140,
    maxProducts: 450,
    maxCharsPerPage: 12000,
    maxCmsCollections: 40,
    maxCmsItemsPerCollection: 150,
    includeSiteProperties: true,
    includeCms: true,
    includeStores: true,
    includeBookings: true,
    includeDomainCrawl: true,
    depthNote: "Deep Wix APIs (pages, CMS, catalog) and a full-domain crawl so the employee answers from this business.",
  },
};

export function scanScopeForPlan(planKey: PlanKey): ScanScope {
  const scope = SCOPES[planKey] ?? SCOPES.FREE;
  return {
    planKey,
    planLabel: PLAN_LABELS[planKey],
    ...scope,
  };
}

const STORE_COLLECTION = /^(stores|ecom|catalog)\//i;
const BOOKING_COLLECTION = /^(bookings|scheduler|wix-bookings)\//i;
const PRIVATE_COLLECTION = /^(members|privatemembersdata|contacts|inbox|form|submissions|marketing)\//i;

/** CMS collections the current paid plan is allowed to ingest. */
export function cmsCollectionAllowed(collectionId: string, scope: Pick<ScanScope, "includeStores" | "includeBookings">) {
  const id = collectionId.trim();
  if (!id || PRIVATE_COLLECTION.test(id)) return false;
  if (STORE_COLLECTION.test(id) && !scope.includeStores) return false;
  if (BOOKING_COLLECTION.test(id) && !scope.includeBookings) return false;
  return true;
}

export const PRIORITY_PATHS = [
  /about/,
  /contact/,
  /faq/,
  /help/,
  /support/,
  /shipping/,
  /delivery/,
  /return/,
  /refund/,
  /privacy/,
  /terms/,
  /policy/,
  /menu/,
  /service/,
  /book/,
  /hours/,
  /location/,
  /shop/,
  /store/,
  /product/,
  /price/,
  /team/,
];

export function pathPriority(url: string) {
  const path = url.toLowerCase();
  const index = PRIORITY_PATHS.findIndex((pattern) => pattern.test(path));
  return index === -1 ? PRIORITY_PATHS.length + 1 : index;
}
