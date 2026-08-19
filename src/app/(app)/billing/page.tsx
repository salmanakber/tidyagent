import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { wixUpgradeUrl } from "@/modules/billing/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { refreshWixBilling } from "@/app/actions/billing";

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);
  const e = data.entitlements;
  const upgradeUrl = wixUpgradeUrl(session.wixInstanceId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Wix billing"
        title="Plan & limits"
        description="Wix handles payment. tidyAgent only stores entitlements. Cancelled plans stay active until the Wix period ends."
        actions={
          <>
            {upgradeUrl ? (
              <a href={upgradeUrl} className="btn-primary" target="_blank" rel="noreferrer">
                {e.isPaidSeat ? "Change plan in Wix" : "Upgrade in Wix"}
              </a>
            ) : (
              <span className="btn-secondary">Upgrade via Wix App Market</span>
            )}
            <form action={refreshWixBilling}>
              <button className="btn-secondary">Refresh from Wix</button>
            </form>
          </>
        }
      />

      {e.cancelAtPeriodEnd ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Auto-renewal is off. You keep paid features until the current Wix billing period ends.
        </div>
      ) : null}
      {e.billingIssue ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Wix still marks this site as paid (billing issue). We will not drop you to Free until Wix sets isFree.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`panel p-6 ${e.isPaidSeat ? "amber-ring" : ""}`}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">Current seat</p>
          <p className="mt-3 font-display text-3xl text-white">{e.planKey}</p>
          <p className="mt-2 text-sm text-navy-300">
            {e.isFree ? "Free install — paid features stay off until Wix reports a plan." : `Status: ${e.status}`}
          </p>
        </div>
        <div className="panel p-6 lg:col-span-2">
          <h2 className="font-display text-xl text-white">What this plan includes</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <li>Conversation limit: {e.conversationLimit.toLocaleString()}</li>
            <li>Knowledge limit: {e.knowledgeLimit.toLocaleString()}</li>
            <li>Voice: {e.voiceEnabled ? "Included" : "Upgrade required"}</li>
            <li>Advanced tools: {e.advancedToolsEnabled ? "Included" : "Upgrade required"}</li>
            <li>Automations: {e.automationEnabled ? "Included" : "Upgrade required"}</li>
            <li>Paid seat: {e.isPaidSeat ? "Yes" : "No"}</li>
          </ul>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">How Wix billing is applied</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-navy-200">
          <li>1. Install → Free. Paid features stay locked.</li>
          <li>2. Paid Plan Purchased (including free-trial signup) → paid seat. Trial has no second webhook when it converts.</li>
          <li>3. Paid Plan Changed → upgrade/downgrade mapped from vendorProductId.</li>
          <li>4. Auto Renewal Cancelled → you keep the plan until period end. We do not immediately revert to Free.</li>
        </ol>
      </div>
    </div>
  );
}
