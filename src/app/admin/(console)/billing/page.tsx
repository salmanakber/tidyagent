import { getPlatformOverview } from "@/modules/admin/reporting";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";

export default async function AdminBillingPage() {
  const data = await getPlatformOverview();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Wix is source of truth"
        title="Subscriptions"
        description="Wix collects payment. We mirror Paid Plan Purchased, Changed, and Auto Renewal Cancelled, then re-check Get App Instance. Cancelled seats stay paid until the period ends."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Paid seats" value={data.paidSeats} />
        <MetricCard label="Trials" value={data.trials} hint="Paid Plan Purchased also fires on trial signup" />
        <MetricCard label="Cancel at period end" value={data.canceling} hint="Not free until expiry" />
        <MetricCard label="Past due / billing issue" value={data.pastDue} hint="Still treated as paid" />
      </div>
      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Plan mix</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-4 text-sm">
          <Mix label="Free" value={data.planMix.FREE} />
          <Mix label="Starter" value={data.planMix.STARTER} />
          <Mix label="Business" value={data.planMix.GROWTH} />
          <Mix label="Pro" value={data.planMix.PRO} />
        </div>
        <p className="mt-6 text-sm leading-6 text-navy-300">
          Trial → first charge has no Wix webhook. Use Sync Wix billing on a site, or wait for the owner to reopen the
          dashboard (Get App Instance). Map each Wix Pricing plan ID with WIX_VENDOR_PRODUCT_STARTER / BUSINESS / PRO.
        </p>
      </div>
    </div>
  );
}

function Mix({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-navy-950/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-navy-400">{label}</p>
      <p className="mt-2 font-display text-2xl text-white">{value}</p>
    </div>
  );
}
