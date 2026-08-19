import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWixAppInstance, type WixSiteSnapshot } from "@/services/wix/client";
import {
  applyAutoRenewalCancelled,
  applyPaidPlanChanged,
  applyPaidPlanPurchased,
  classifyWixEvent,
  deriveFromWixSnapshot,
  type BillingEventInput,
  type DerivedSubscription,
} from "@/modules/billing/lifecycle";
import { resolveEntitlements, withComplimentaryGrant, type Entitlements } from "@/modules/billing/entitlements";

export type WixWebhookEnvelope = {
  eventType?: string;
  instanceId?: string;
  uid?: string;
  data?: Record<string, unknown>;
  metadata?: { instanceId?: string; eventType?: string };
};

export async function persistBillingEvent(input: {
  wixInstanceId: string;
  eventType: string;
  vendorProductId?: string | null;
  payload: Prisma.InputJsonValue;
}) {
  const site = await prisma.wixSite.findUnique({ where: { wixInstanceId: input.wixInstanceId } });
  await prisma.billingEvent.create({
    data: {
      wixInstanceId: input.wixInstanceId,
      organizationId: site?.organizationId,
      siteId: site?.id,
      eventType: input.eventType,
      vendorProductId: input.vendorProductId ?? undefined,
      payload: input.payload,
    },
  });
}

export async function applyWixBillingWebhook(envelope: WixWebhookEnvelope) {
  const instanceId = envelope.instanceId ?? envelope.metadata?.instanceId;
  if (!instanceId) throw new Error("Webhook missing instanceId");

  const eventType = envelope.eventType ?? envelope.metadata?.eventType ?? "unknown";
  const data = flattenWebhookData(envelope.data);
  const kind = classifyWixEvent(eventType);

  await persistBillingEvent({
    wixInstanceId: instanceId,
    eventType,
    vendorProductId: vendorProductFrom(data) ?? vendorProductFrom(envelope as unknown as Record<string, unknown>),
    payload: envelope as Prisma.InputJsonValue,
  });

  if (kind === "removed") {
    await prisma.wixSite.updateMany({
      where: { wixInstanceId: instanceId },
      data: { connectionStatus: "removed" },
    });
    return;
  }

  const snapshot = await fetchWixAppInstance(instanceId).catch(() => null);
  const event: BillingEventInput = {
    eventType,
    vendorProductId: vendorProductFrom(data) ?? vendorProductFrom(envelope as unknown as Record<string, unknown>),
    cycle: asString(data.cycle) ?? asString(data.billingCycle),
    expiresOn: asString(data.expiresOn) ?? asString(data.expirationDate),
    invoiceId: asString(data.invoiceId),
    couponName: asString(data.couponName),
    previousVendorProductId: asString(data.previousVendorProductId),
    cancelReason: asString(data.cancelReason) ?? asString(data.userReason),
    cancelledDuringFreeTrial: asString(data.cancelledDuringFreeTrial),
  };

  await upsertSubscriptionFromWix({
    instanceId,
    snapshot,
    event,
    kind,
  });
}

export async function syncSubscriptionFromWix(instanceId: string) {
  const snapshot = await fetchWixAppInstance(instanceId);
  await upsertSubscriptionFromWix({
    instanceId,
    snapshot,
    kind: "sync",
  });
  return snapshot;
}

async function upsertSubscriptionFromWix(input: {
  instanceId: string;
  snapshot: WixSiteSnapshot | null;
  event?: BillingEventInput;
  kind: ReturnType<typeof classifyWixEvent> | "sync";
}) {
  const site = await prisma.wixSite.findUnique({
    where: { wixInstanceId: input.instanceId },
  });
  if (!site) return;

  const currentRow = await prisma.subscription.findFirst({
    where: { organizationId: site.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const currentDerived: DerivedSubscription | undefined = currentRow
    ? {
        isFree: currentRow.isFree,
        planKey: currentRow.planKey,
        status: currentRow.status,
        vendorProductId: currentRow.vendorProductId,
        billingCycle: currentRow.billingCycle,
        autoRenewing: currentRow.autoRenewing,
        cancelAtPeriodEnd: currentRow.cancelAtPeriodEnd,
        billingIssue: currentRow.billingIssue,
        trialEndsAt: currentRow.trialEndsAt,
        currentPeriodEnd: currentRow.currentPeriodEnd,
        invoiceId: currentRow.invoiceId,
        couponName: currentRow.couponName,
        previousVendorProductId: currentRow.previousVendorProductId,
        cancelReason: currentRow.cancelReason,
      }
    : undefined;

  const snapshotBilling = input.snapshot
    ? {
        isFree: input.snapshot.isFree,
        vendorProductId: input.snapshot.vendorProductId,
        packageName: input.snapshot.billing?.packageName ?? input.snapshot.vendorProductId,
        billingCycle: input.snapshot.billing?.billingCycle,
        expirationDate: input.snapshot.billing?.expirationDate,
        autoRenewing: input.snapshot.billing?.autoRenewing,
        freeTrialStatus: input.snapshot.billing?.freeTrialStatus,
        freeTrialEndDate: input.snapshot.billing?.freeTrialEndDate,
      }
    : null;

  let derived: DerivedSubscription;
  if (input.kind === "purchased" && input.event) {
    derived = applyPaidPlanPurchased(input.event, snapshotBilling);
  } else if (input.kind === "changed" && input.event && currentDerived) {
    derived = applyPaidPlanChanged(input.event, currentDerived, snapshotBilling);
  } else if (input.kind === "cancel_autorenew" && input.event && currentDerived) {
    derived = applyAutoRenewalCancelled(input.event, currentDerived);
  } else if (snapshotBilling) {
    derived = deriveFromWixSnapshot(snapshotBilling, currentDerived);
  } else if (currentDerived) {
    derived = currentDerived;
  } else {
    return;
  }

  const plan = await prisma.plan.findUniqueOrThrow({ where: { key: derived.planKey } });
  const data = {
    planId: plan.id,
    planKey: derived.planKey,
    status: derived.status,
    isFree: derived.isFree,
    vendorProductId: derived.vendorProductId,
    billingCycle: derived.billingCycle,
    autoRenewing: derived.autoRenewing,
    cancelAtPeriodEnd: derived.cancelAtPeriodEnd,
    canceledAt: derived.cancelAtPeriodEnd ? new Date() : null,
    cancelReason: derived.cancelReason,
    invoiceId: derived.invoiceId,
    couponName: derived.couponName,
    previousVendorProductId: derived.previousVendorProductId,
    billingIssue: derived.billingIssue,
    trialEndsAt: derived.trialEndsAt,
    currentPeriodEnd: derived.currentPeriodEnd,
    rawBilling: (input.snapshot?.billing ?? snapshotBilling) as Prisma.InputJsonValue,
  };

  if (currentRow) {
    await prisma.subscription.update({ where: { id: currentRow.id }, data });
  } else {
    await prisma.subscription.create({
      data: { organizationId: site.organizationId, ...data },
    });
  }

  await prisma.wixSite.update({
    where: { id: site.id },
    data: {
      lastBillingSyncedAt: new Date(),
      lastSyncedAt: new Date(),
      displayName: input.snapshot?.site.displayName ?? undefined,
      url: input.snapshot?.site.url ?? undefined,
    },
  });
}

export async function entitlementsForOrganization(organizationId: string): Promise<Entitlements> {
  const [subscription, organization] = await Promise.all([
    prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ]);

  const suspended = organization?.accessStatus === "suspended";
  const grant = organization?.compPlanKey ?? null;

  if (!subscription) {
    return withComplimentaryGrant(
      resolveEntitlements({
        planKey: "FREE",
        status: "NONE",
        isFree: true,
        suspended,
      }),
      grant,
      suspended,
    );
  }

  return withComplimentaryGrant(
    resolveEntitlements({
      planKey: subscription.planKey,
      status: subscription.status,
      isFree: subscription.isFree,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      billingIssue: subscription.billingIssue,
      currentPeriodEnd: subscription.currentPeriodEnd,
      suspended,
    }),
    grant,
    suspended,
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function flattenWebhookData(data?: Record<string, unknown>) {
  const base = { ...(data ?? {}) };
  const nested = base.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...base, ...(nested as Record<string, unknown>) };
  }
  return base;
}

function vendorProductFrom(data?: Record<string, unknown> | null) {
  if (!data) return null;
  return (
    asString(data.vendorProductId) ??
    asString(data.packageName) ??
    asString(data.productId) ??
    asString(data.planId)
  );
}
