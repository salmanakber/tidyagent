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
