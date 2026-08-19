import { getPlatformOverview } from "@/modules/admin/reporting";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatNumber, relativeTime } from "@/lib/utils";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const data = await getPlatformOverview();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operator console"
        title="All websites"
        description="Installs, Wix billing seats, and AI usage across every tenant. Customer workspaces stay isolated — this view is platform-only."
        actions={
          <Link href="/admin/sites" className="btn-primary">
            Manage websites
          </Link>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Connected sites" value={formatNumber(data.connected)} hint={`${data.sites} total installs`} />
        <MetricCard label="Paid seats" value={formatNumber(data.paidSeats)} hint={`${data.trials} in trial`} />
        <MetricCard label="Conversations" value={formatNumber(data.conversations)} />
        <MetricCard label="Open escalations" value={formatNumber(data.escalations)} />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Wix plan mix</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Free" value={data.planMix.FREE} />
            <Row label="Starter" value={data.planMix.STARTER} />
            <Row label="Business" value={data.planMix.GROWTH} />
            <Row label="Pro" value={data.planMix.PRO} />
            <Row label="Cancel at period end" value={data.canceling} />
            <Row label="Billing issue / past due" value={data.pastDue} />
            <Row label="Suspended by us" value={data.suspended} />
          </dl>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Recent Wix billing events</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {data.billingEvents.length === 0 ? (
              <li className="text-navy-300">No webhooks yet. They appear after Paid Plan Purchased / Changed / Cancelled.</li>
            ) : (
              data.billingEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{event.eventType}</span>
                  <span className="shrink-0 text-xs text-navy-400">{relativeTime(event.createdAt)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-navy-300">{label}</dt>
      <dd className="text-white">{value}</dd>
    </div>
  );
}
