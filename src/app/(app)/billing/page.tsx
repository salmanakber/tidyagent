import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { wixUpgradeUrl, planLabel } from "@/modules/billing/catalog";
import { bulletsForPlanScope } from "@/modules/billing/plan-scopes";
import { getAllPlanScopes } from "@/modules/billing/plan-scope-store";
import { getDisplayPricing } from "@/modules/billing/display-prices";
import { formatListedPrice } from "@/modules/billing/platform-prices";
import { PageHeader } from "@/components/ui/PageHeader";
import { refreshWixBilling } from "@/app/actions/billing";
import { isWixPlatform, platformLabel, resolveSitePlatform } from "@/modules/platforms";
import { bulletsForPlatform } from "@/modules/platforms/copy";

const PAID_PLANS = ["STARTER", "GROWTH", "PRO"] as const;

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const platform = resolveSitePlatform(session.platform);
  const wix = isWixPlatform(platform);
  const name = platformLabel(platform);
  const [data, scopes, pricing] = await Promise.all([
    getDashboardOverview(session),
    getAllPlanScopes(),
    getDisplayPricing(platform),
  ]);
  const e = data.entitlements;
  const upgradeUrl = wix ? wixUpgradeUrl(session.wixInstanceId) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${name} billing`}
        title={e.isPaidSeat ? "Plan & limits" : "Choose a plan to go live"}
        description={
          wix
            ? e.isPaidSeat
              ? "Checkout stays on Wix. Paid plans include a 7-day free trial."
              : "The dashboard and live chat stay off until a plan is purchased. Start a 7-day trial — Starter, Business, or Pro."
            : e.isPaidSeat
              ? `Current plan and limits for this ${name} site.`
              : `The dashboard and live chat stay off until a plan is active on this ${name} site.`
        }
        actions={
          wix ? (
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
          ) : null
        }
      />

      {e.grantedByAdmin ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          This workspace has complimentary paid access from the platform owner.
        </div>
      ) : null}

      {wix && e.status === "TRIALING" && !e.grantedByAdmin ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          7-day free trial is active. Wix charges when the trial ends. Click Refresh from Wix after day 7, or reopen the
          dashboard.
        </div>
      ) : null}
      {wix && e.cancelAtPeriodEnd ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Auto-renewal is off. You keep paid features until the current billing period ends.
        </div>
      ) : null}
      {wix && e.billingIssue ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          This site is still marked as paid (billing issue). We will not drop you to Free until that flag clears.
        </div>
      ) : null}

      {!wix && !e.isPaidSeat ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-navy-200">
          Checkout for {name} is being connected. Complimentary access from the platform owner still applies. Prices
          below are the current {name} packages.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {PAID_PLANS.map((key) => {
          const current = e.planKey === key && e.isPaidSeat;
          const price = pricing.plans[key];
          const monthly = formatListedPrice(price.monthly, pricing.symbol);
          const yearly = formatListedPrice(price.yearly, pricing.symbol);
          const bullets = bulletsForPlatform(platform, bulletsForPlanScope(key, scopes[key]));
          return (
            <div key={key} className={`panel p-6 ${current ? "amber-ring" : ""}`}>
              <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">
                {current ? "Current plan" : "Package"}
              </p>
              <p className="mt-3 font-display text-3xl text-white">{planLabel(key)}</p>
              <p className="mt-2 text-2xl text-amber-200">
                {monthly ? (
                  <>
                    {monthly}
                    <span className="text-sm font-normal text-navy-300"> / month</span>
                  </>
                ) : (
                  <span className="text-lg text-navy-400">Price on request</span>
                )}
              </p>
              {yearly ? <p className="mt-1 text-sm text-navy-300">{yearly} / year</p> : null}
              {pricing.trialDays > 0 ? (
                <p className="mt-1 text-xs text-navy-400">{pricing.trialDays}-day trial on signup</p>
              ) : null}
              <ul className="mt-4 space-y-2 text-sm text-navy-200">
                {bullets.filter((item) => !/7-day/i.test(item)).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {wix && upgradeUrl ? (
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

      {wix ? (
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">How a purchase reaches this backend</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-navy-200">
            <li>1. Customer picks Starter, Business, or Pro on the Wix pricing page.</li>
            <li>2. Wix POSTs one webhook to /api/wix/webhooks with vendorProductId for that package.</li>
            <li>3. We map that ID to Starter / Business / Pro and unlock the matching features.</li>
            <li>4. Plan Changed and Auto Renewal Cancelled use the same URL. Cancelled seats stay paid until period end.</li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}
