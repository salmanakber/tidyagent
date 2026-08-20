import type { PlanKey } from "@prisma/client";
import { PLAN_LABELS } from "@/modules/billing/catalog";
import { DEFAULT_PLAN_SCOPES, type PlanScopeConfig } from "@/modules/billing/plan-scopes";

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
  /** Per-scan option. When true, keep crawling discovered URLs instead of stopping at priority paths. */
  fullSiteCrawl?: boolean;
};

export function scanScopeFromConfig(planKey: PlanKey, config?: PlanScopeConfig): ScanScope {
  const scope = config ?? DEFAULT_PLAN_SCOPES[planKey] ?? DEFAULT_PLAN_SCOPES.FREE;
  return {
    planKey,
    planLabel: PLAN_LABELS[planKey],
    ...scope.scan,
  };
}

/** Defaults only. Live admin overrides come from `scanScopeFromConfig` + stored plan scopes. */
export function scanScopeForPlan(planKey: PlanKey): ScanScope {
  return scanScopeFromConfig(planKey);
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

/** Generic page types every kind of site may use. Never put product or brand names here. */
export const PRIORITY_PATHS = [
  /pric/,
  /plan/,
  /package/,
  /service/,
  /rate/,
  /rental/,
  /offer/,
  /book/,
  /appoint/,
  /menu/,
  /shop/,
  /store/,
  /product/,
  /catalog/,
  /collection/,
  /membership/,
  /class/,
  /lesson/,
  /tour/,
  /experience/,
  /treatment/,
  /faq/,
  /about/,
  /contact/,
  /help/,
  /support/,
  /shipping/,
  /delivery/,
  /return/,
  /refund/,
  /hours/,
  /location/,
  /privacy/,
  /terms/,
  /policy/,
  /team/,
];

export function pathPriority(url: string) {
  const path = url.toLowerCase();
  const index = PRIORITY_PATHS.findIndex((pattern) => pattern.test(path));
  return index === -1 ? PRIORITY_PATHS.length + 1 : index;
}
