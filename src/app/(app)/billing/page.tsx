import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { wixUpgradeUrl, planLabel } from "@/modules/billing/catalog";
import { bulletsForPlanScope } from "@/modules/billing/plan-scopes";
import { getAllPlanScopes } from "@/modules/billing/plan-scope-store";
import { getDisplayPricing } from "@/modules/billing/display-prices";
import { formatListedPrice } from "@/modules/billing/platform-prices";
import { isStripeCheckoutConfigured } from "@/modules/billing/stripe/config";
import { PageHeader } from "@/components/ui/PageHeader";
import { refreshWixBilling } from "@/app/actions/billing";
import {
  isShopifyPlatform,
  isWebflowPlatform,
  isWixPlatform,
  platformLabel,
  resolveSitePlatform,
} from "@/modules/platforms";
import { bulletsForPlatform } from "@/modules/platforms/copy";
import { prisma } from "@/lib/prisma";

const PAID_PLANS = ["STARTER", "GROWTH", "PRO"] as const;

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const platform = resolveSitePlatform(session.platform);
  const wix = isWixPlatform(platform);
  const webflow = isWebflowPlatform(platform);
  const shopify = isShopifyPlatform(platform);
  const name = platformLabel(platform);
  const [data, scopes, pricing, cardReady, subscription] = await Promise.all([
    getDashboardOverview(session),
    getAllPlanScopes(),
    getDisplayPricing(platform),
    webflow ? isStripeCheckoutConfigured() : Promise.resolve(false),
    webflow
      ? prisma.subscription.findFirst({
          where: { organizationId: session.organizationId },
          orderBy: { createdAt: "desc" },
          select: { stripeCustomerId: true, status: true },
        })
      : Promise.resolve(null),
  ]);
  const e = data.entitlements;
  const upgradeUrl = wix ? wixUpgradeUrl(session.wixInstanceId) : null;
  const hasCardCustomer = Boolean(subscription?.stripeCustomerId);
  const checkoutReady = wix ? Boolean(upgradeUrl) : webflow ? cardReady : shopify;

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
            : shopify
              ? e.isPaidSeat
                ? `Current plan and limits for this ${name} store. Billing is managed in Shopify.`
                : `Pick a plan below. Checkout and charges stay inside Shopify Admin.`
              : e.isPaidSeat
                ? `Current plan and limits for this ${name} site.`
                : cardReady
                  ? `Pick a plan below. Paid plans include a ${pricing.trialDays}-day trial when configured.`
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
          ) : webflow && hasCardCustomer ? (
            <a href="/api/billing/stripe/portal" className="btn-secondary">
              Manage billing
            </a>
          ) : shopify && e.isPaidSeat ? (
            <a
              href={`https://${session.wixInstanceId.replace(/^shopify:/, "")}/admin/settings/billing`}
              className="btn-secondary"
              target="_blank"
              rel="noreferrer"
            >
              Manage in Shopify
            </a>
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

      {!wix && e.status === "TRIALING" && !e.grantedByAdmin ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          {shopify
            ? "Your Shopify trial is active. Shopify charges when the trial ends unless you cancel the app subscription."
            : "Your free trial is active. You will be charged when the trial ends unless you cancel from Manage billing."}
        </div>
      ) : null}
      {!wix && e.cancelAtPeriodEnd ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Cancellation is scheduled. You keep paid features until the current billing period ends.
        </div>
      ) : null}
      {!wix && e.billingIssue ? (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          {shopify
            ? "There is a payment issue on this Shopify subscription. Update billing in Shopify Admin."
            : "There is a payment issue on this plan. Update your card in Manage billing, or contact support."}
        </div>
      ) : null}

      {webflow && !e.isPaidSeat && !cardReady ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-navy-200">
          Card checkout is not configured yet. An operator must add payment keys in Admin → Settings.
          Complimentary access from the platform owner still applies. Prices below are the current {name} packages.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {PAID_PLANS.map((key) => {
          const current = e.planKey === key && e.isPaidSeat;
          const price = pricing.plans[key];
          const monthly = formatListedPrice(price.monthly, pricing.symbol);
          const yearly = formatListedPrice(price.yearly, pricing.symbol);
          const bullets = bulletsForPlatform(platform, bulletsForPlanScope(key, scopes[key]));
          const planParam = key === "GROWTH" ? "BUSINESS" : key;
          const checkoutHref = !checkoutReady
            ? null
            : wix
              ? `/api/billing/checkout?plan=${planParam}`
              : shopify
                ? `/api/billing/shopify/checkout?plan=${planParam}`
                : `/api/billing/stripe/checkout?plan=${planParam}`;
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
              {checkoutHref ? (
                <a href={checkoutHref} className="btn-secondary mt-6 inline-flex">
                  {wix
                    ? current
                      ? "Manage in Wix"
                      : `Start ${planLabel(key)} trial`
                    : shopify
                      ? current
                        ? "Change plan in Shopify"
                        : `Start ${planLabel(key)} in Shopify`
                      : current
                        ? "Change plan"
                        : `Start ${planLabel(key)}`}
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
      ) : shopify ? (
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">How billing works for Shopify</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-navy-200">
            <li>1. Merchant picks Starter, Business, or Pro on this page.</li>
            <li>2. Shopify shows its native app charge approval screen (Admin listed prices).</li>
            <li>3. After approval, Shopify notifies this app and the matching plan unlocks.</li>
            <li>4. Charges and invoices stay inside Shopify Admin.</li>
          </ol>
        </div>
      ) : (
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">How billing works for {name}</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-navy-200">
            <li>1. Customer picks Starter, Business, or Pro on this page.</li>
            <li>2. Secure checkout opens with the Admin-listed {name} price (and trial days when set).</li>
            <li>3. After payment succeeds, this workspace unlocks the matching plan.</li>
            <li>4. You can manage the card and renewals from Manage billing.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
