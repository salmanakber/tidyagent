import { redirect } from "next/navigation";
import type { PlanKey } from "@prisma/client";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { wixUpgradeUrl, planLabel } from "@/modules/billing/catalog";
import { bulletsForPlanScope } from "@/modules/billing/plan-scopes";
import { getAllPlanScopes } from "@/modules/billing/plan-scope-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { refreshWixBilling } from "@/app/actions/billing";
import { isWixPlatform, platformLabel } from "@/modules/platforms";

const PAID_PLANS: PlanKey[] = ["STARTER", "GROWTH", "PRO"];

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);
  const e = data.entitlements;
  const scopes = await getAllPlanScopes();

  if (!isWixPlatform(session.platform)) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={`${platformLabel(session.platform)} billing`}
          title="Billing for this platform is next"
          description={`${platformLabel(session.platform)} checkout is not wired yet. Existing Wix customers still pay only through Wix. Complimentary seats still work.`}
        />
      </div>
    );
  }

  const upgradeUrl = wixUpgradeUrl(session.wixInstanceId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Wix billing"
        title={e.isPaidSeat ? "Plan & limits" : "Choose a plan to go live"}
        description={
          e.isPaidSeat
            ? "Checkout stays on Wix. Paid plans include a 7-day free trial. Trial signup fires Paid Plan Purchased; the first charge after trial does not."
            : "The dashboard and live chat bubble stay off until a plan is purchased. Start a 7-day trial on Wix — Starter, Business, or Pro."
        }
        actions={
          <>
            {upgradeUrl ? (
              <a href={upgradeUrl} className="btn-primary" target="_blank" rel="noreferrer">
                {e.isPaidSeat ? "Change plan in Wix" : "View Wix pricing"}
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

      {e.grantedByAdmin ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          This workspace has complimentary paid access from the platform owner. Wix checkout is optional while the
          grant is active.
        </div>
      ) : null}
      {e.status === "TRIALING" && !e.grantedByAdmin ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          7-day free trial is active. Wix charges when the trial ends. That conversion has no webhook — click Refresh
          from Wix after day 7, or just reopen the dashboard.
        </div>
      ) : null}
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
        {PAID_PLANS.map((key) => {
          const current = e.planKey === key && e.isPaidSeat;
          return (
            <div key={key} className={`panel p-6 ${current ? "amber-ring" : ""}`}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">
                {current ? "Current plan" : "Package"}
              </p>
              <p className="mt-3 font-display text-3xl text-white">{planLabel(key)}</p>
              <ul className="mt-4 space-y-2 text-sm text-navy-200">
                {bulletsForPlanScope(key, scopes[key]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {upgradeUrl ? (
                <a
                  href={`/api/billing/checkout?plan=${key === "GROWTH" ? "BUSINESS" : key}`}
                  className="btn-secondary mt-6 inline-flex"
                >
                  {current ? "Manage in Wix" : `Start ${planLabel(key)} trial`}
                </a>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">How a purchase reaches this backend</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-navy-200">
          <li>1. Customer picks Starter, Business, or Pro on the Wix pricing page (not Stripe).</li>
          <li>2. Wix POSTs one webhook to /api/wix/webhooks with vendorProductId for that package.</li>
          <li>3. We map that ID to Starter / Business / Pro and unlock the matching features.</li>
          <li>4. Plan Changed and Auto Renewal Cancelled use the same URL. Cancelled seats stay paid until period end.</li>
        </ol>
      </div>
    </div>
  );
}
