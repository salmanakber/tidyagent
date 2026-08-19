import { notFound } from "next/navigation";
import { getManagedSite } from "@/modules/admin/reporting";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { SiteAdminActions } from "@/components/admin/SiteAdminActions";
import { relativeTime } from "@/lib/utils";
import { planLabel } from "@/modules/billing/catalog";

export default async function AdminSiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const data = await getManagedSite(siteId);
  if (!data) notFound();
  const { site, events } = data;
  const subscription = site.organization.subscriptions[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Website"
        title={site.displayName || site.organization.name}
        description="Platform control for this Wix install. Billing still comes from Wix; we only store entitlements and access."
        actions={<SiteAdminActions siteId={site.id} suspended={site.organization.accessStatus === "suspended"} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Connection</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Instance" value={site.wixInstanceId} />
            <Row label="Owner" value={site.ownerEmail || "—"} />
            <Row label="URL" value={site.url || "Unpublished"} />
            <Row label="Onboarding" value={site.organization.onboardingStatus} />
            <div className="flex justify-between">
              <dt className="text-navy-300">Wix status</dt>
              <dd>
                <StatusPill status={site.connectionStatus} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-navy-300">Access</dt>
              <dd>
                <StatusPill status={site.organization.accessStatus} />
              </dd>
            </div>
          </dl>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Wix subscription</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Plan" value={subscription ? planLabel(subscription.planKey) : "Free"} />
            <Row label="Status" value={subscription?.status ?? "NONE"} />
            <Row label="vendorProductId" value={subscription?.vendorProductId || "—"} />
            <Row label="Cycle" value={subscription?.billingCycle || "—"} />
            <Row label="Auto-renew" value={subscription?.autoRenewing ? "On" : "Off"} />
            <Row label="Cancel at period end" value={subscription?.cancelAtPeriodEnd ? "Yes" : "No"} />
            <Row
              label="Period end"
              value={subscription?.currentPeriodEnd ? subscription.currentPeriodEnd.toLocaleDateString() : "—"}
            />
            <Row label="Billing issue" value={subscription?.billingIssue ? "Yes — still treated as paid" : "No"} />
          </dl>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Usage</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Conversations" value={String(site.organization._count.conversations)} />
            <Row label="Customers" value={String(site.organization._count.customers)} />
            <Row label="Knowledge" value={String(site.organization._count.knowledgeDocuments)} />
            <Row label="Escalations" value={String(site.organization._count.humanEscalations)} />
            <Row label="Agent" value={site.organization.agents[0]?.status ?? "None"} />
          </dl>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Billing webhooks</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {events.length === 0 ? (
              <li className="text-navy-300">No Wix billing events stored yet.</li>
            ) : (
              events.map((event) => (
                <li key={event.id}>
                  <p className="text-white">{event.eventType}</p>
                  <p className="text-xs text-navy-400">
                    {relativeTime(event.createdAt)}
                    {event.vendorProductId ? ` · ${event.vendorProductId}` : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-navy-300">{label}</dt>
      <dd className="max-w-[60%] break-all text-right text-white">{value}</dd>
    </div>
  );
}
