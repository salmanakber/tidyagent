import type { PlanKey, SubscriptionStatus } from "@prisma/client";
import { mapWixPackageToPlan } from "@/modules/billing/catalog";

export type WixBillingSnapshot = {
  isFree: boolean;
  vendorProductId?: string | null;
  packageName?: string | null;
  billingCycle?: string | null;
  expirationDate?: string | null;
  autoRenewing?: boolean | null;
  freeTrialStatus?: string | null;
  freeTrialEndDate?: string | null;
};

export type BillingEventInput = {
  eventType: string;
  vendorProductId?: string | null;
  cycle?: string | null;
  expiresOn?: string | null;
  invoiceId?: string | null;
  couponName?: string | null;
  previousVendorProductId?: string | null;
  cancelReason?: string | null;
  cancelledDuringFreeTrial?: string | null;
};

export type DerivedSubscription = {
  isFree: boolean;
  planKey: PlanKey;
  status: SubscriptionStatus;
  vendorProductId: string | null;
  billingCycle: string | null;
  autoRenewing: boolean;
  cancelAtPeriodEnd: boolean;
  billingIssue: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  invoiceId: string | null;
  couponName: string | null;
  previousVendorProductId: string | null;
  cancelReason: string | null;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function paidPlanId(snapshot: WixBillingSnapshot) {
  return snapshot.packageName || snapshot.vendorProductId || null;
}

/**
 * Derive local entitlements from Get App Instance.
 * Wix is the billing source of truth.
 *
 * Rules from Wix purchase lifecycle:
 * - isFree true + no vendorProductId → free
 * - Paid Plan Purchased (incl. trial signup) → isFree false
 * - Trial: freeTrialInfo.status IN_PROGRESS; expirationDate may be missing until trial ends
 * - Trial → first charge has NO webhook; re-fetch Get App Instance
 * - Auto-renewal cancelled: still paid until period ends; do not downgrade immediately
 * - expirationDate passed but isFree still false → billing issue; still treat as paid
 */
export function deriveFromWixSnapshot(
  snapshot: WixBillingSnapshot,
  previous?: Partial<Pick<DerivedSubscription, "cancelAtPeriodEnd" | "cancelReason" | "invoiceId" | "couponName" | "previousVendorProductId">>,
  now = new Date(),
): DerivedSubscription {
  const vendorProductId = paidPlanId(snapshot);
  const currentPeriodEnd = parseDate(snapshot.expirationDate);
  const trialEndsAt = parseDate(snapshot.freeTrialEndDate);
  const inTrial = snapshot.freeTrialStatus === "IN_PROGRESS";
  const expiredDate = currentPeriodEnd ? currentPeriodEnd.getTime() < now.getTime() : false;

  if (snapshot.isFree && !vendorProductId) {
    return {
      isFree: true,
      planKey: "FREE",
      status: previous?.cancelAtPeriodEnd ? "EXPIRED" : "NONE",
      vendorProductId: null,
      billingCycle: snapshot.billingCycle ?? null,
      autoRenewing: false,
      cancelAtPeriodEnd: false,
      billingIssue: false,
      trialEndsAt: null,
      currentPeriodEnd,
      invoiceId: previous?.invoiceId ?? null,
      couponName: previous?.couponName ?? null,
      previousVendorProductId: previous?.previousVendorProductId ?? null,
      cancelReason: previous?.cancelReason ?? null,
    };
  }

  const planKey = mapWixPackageToPlan(vendorProductId);
  const billingIssue = Boolean(!snapshot.isFree && expiredDate && !inTrial);
  const cancelAtPeriodEnd = Boolean(previous?.cancelAtPeriodEnd && !snapshot.isFree);

  let status: SubscriptionStatus = "ACTIVE";
  if (inTrial) status = "TRIALING";
  else if (billingIssue) status = "PAST_DUE";
  else if (cancelAtPeriodEnd) status = "CANCELED";

  return {
    isFree: false,
    planKey: planKey === "FREE" ? "STARTER" : planKey,
    status,
    vendorProductId,
    billingCycle: snapshot.billingCycle ?? null,
    autoRenewing: snapshot.autoRenewing ?? !cancelAtPeriodEnd,
    cancelAtPeriodEnd,
    billingIssue,
    trialEndsAt,
    currentPeriodEnd,
    invoiceId: previous?.invoiceId ?? null,
    couponName: previous?.couponName ?? null,
    previousVendorProductId: previous?.previousVendorProductId ?? null,
    cancelReason: previous?.cancelReason ?? null,
  };
}

export function applyPaidPlanPurchased(
  event: BillingEventInput,
  snapshot?: WixBillingSnapshot | null,
): DerivedSubscription {
  const fromSnapshot = snapshot
    ? deriveFromWixSnapshot(snapshot)
    : null;

  const vendorProductId = event.vendorProductId || fromSnapshot?.vendorProductId || null;
  const planKeyRaw = mapWixPackageToPlan(vendorProductId);
  const inTrial = snapshot?.freeTrialStatus === "IN_PROGRESS" || (!event.expiresOn && snapshot?.freeTrialStatus !== "ENDED");

  return {
    isFree: false,
    planKey: planKeyRaw === "FREE" ? "STARTER" : planKeyRaw,
    status: inTrial ? "TRIALING" : "ACTIVE",
    vendorProductId,
    billingCycle: event.cycle ?? fromSnapshot?.billingCycle ?? null,
    autoRenewing: true,
    cancelAtPeriodEnd: false,
    billingIssue: false,
    trialEndsAt: fromSnapshot?.trialEndsAt ?? null,
    currentPeriodEnd: parseDate(event.expiresOn) ?? fromSnapshot?.currentPeriodEnd ?? null,
    invoiceId: event.invoiceId ?? null,
    couponName: event.couponName ?? null,
    previousVendorProductId: null,
    cancelReason: null,
  };
}

export function applyPaidPlanChanged(
  event: BillingEventInput,
  current: DerivedSubscription,
  snapshot?: WixBillingSnapshot | null,
): DerivedSubscription {
  const base = snapshot ? deriveFromWixSnapshot(snapshot, current) : { ...current };
  const vendorProductId = event.vendorProductId || base.vendorProductId;
  return {
    ...base,
    isFree: false,
    planKey: mapWixPackageToPlan(vendorProductId) === "FREE" ? base.planKey : mapWixPackageToPlan(vendorProductId),
    status: base.status === "TRIALING" ? "TRIALING" : "ACTIVE",
    vendorProductId,
    billingCycle: event.cycle ?? base.billingCycle,
    autoRenewing: true,
    cancelAtPeriodEnd: false,
    previousVendorProductId: event.previousVendorProductId ?? current.vendorProductId,
    invoiceId: event.invoiceId ?? base.invoiceId,
    couponName: event.couponName ?? base.couponName,
  };
}

/**
 * User remains a paying customer until the period (or trial) ends.
 * Never drop to free on this event.
 */
export function applyAutoRenewalCancelled(
  event: BillingEventInput,
  current: DerivedSubscription,
): DerivedSubscription {
  return {
    ...current,
    autoRenewing: false,
    cancelAtPeriodEnd: true,
    status: current.status === "TRIALING" ? "TRIALING" : "CANCELED",
    cancelReason: event.cancelReason ?? event.cancelledDuringFreeTrial ?? current.cancelReason,
  };
}

export function normalizeWixEventType(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/[_\s]/g, "-");
}

export function classifyWixEvent(eventType?: string | null) {
  const type = normalizeWixEventType(eventType);
  if (type.includes("uninstalled") || type.includes("app-instance-removed") || type.includes("appinstanceremoved")) {
    return "removed" as const;
  }
  if (type.includes("app-instance-installed") || type.includes("appinstanceinstalled")) return "installed" as const;
  if (type.includes("paid-plan-purchased") || type.includes("paidplanpurchased")) return "purchased" as const;
  if (type.includes("paid-plan-changed") || type.includes("paidplanchanged")) return "changed" as const;
  if (type.includes("auto-renewal-cancelled") || type.includes("autorenewalcancelled") || type.includes("paid-plan-auto")) {
    return "cancel_autorenew" as const;
  }
  return "unknown" as const;
}
