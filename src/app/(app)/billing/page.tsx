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
import { ShopifyBillingPlans } from "@/components/shopify/ShopifyBillingPlans";
import { WebflowBillingPlans } from "@/components/webflow/WebflowBillingPlans";
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

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  const params = await searchParams;
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
  const shopDomain = shopify ? session.wixInstanceId.replace(/^shopify:/, "") : "";
  const needsPlanPick =
    (shopify || webflow) && data.organization.onboardingStatus === "SITE_CONNECTED";

  const description = needsPlanPick
    ? "Continue with Free, or pick a paid plan for higher limits."
    : e.isPaidSeat
      ? `Current plan for this ${name} site.`
      : wix
        ? "Choose Starter, Business, or Pro to unlock the dashboard."
        : `Pick a plan below to continue on ${name}.`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${name} billing`}
        title={needsPlanPick ? "Choose your plan" : e.isPaidSeat ? "Plan & limits" : "Choose a plan"}
        description={description}
        actions={
          wix ? (
            <>
              {upgradeUrl ? (
                <a href={upgradeUrl} className="btn-primary" target="_blank" rel="noreferrer">
                  {e.isPaidSeat ? "Change in Wix" : "View Wix pricing"}
                </a>
              ) : (
                <span className="btn-secondary">Upgrade via Wix</span>
              )}
              <form action={refreshWixBilling}>
                <button className="btn-secondary">Refresh</button>
              </form>
            </>
          ) : webflow && hasCardCustomer ? (
            <a href="/api/billing/stripe/portal" className="btn-secondary">
              Manage billing
            </a>
          ) : shopify && e.isPaidSeat && shopDomain ? (
            <a
              href={`https://admin.shopify.com/store/${shopDomain.replace(/\.myshopify\.com$/i, "")}/settings/billing`}
              className="btn-secondary"
              target="_top"
              rel="noopener"
            >
              Manage in Shopify
            </a>
          ) : null
        }
      />

      {params.error || params.checkout === "success" || e.grantedByAdmin || e.status === "TRIALING" || e.cancelAtPeriodEnd || e.billingIssue || (webflow && !e.isPaidSeat && !cardReady && !needsPlanPick) ? (
        <div className="space-y-3">
          {shopify && params.error === "checkout" ? (
            <Alert tone="rose">Could not start billing. Please try again in a moment.</Alert>
          ) : null}
          {shopify && params.error === "app_pricing" ? (
            <Alert tone="rose">Billing setup needs a quick update from the app publisher. Try again shortly.</Alert>
          ) : null}
          {shopify && params.error === "plan" ? (
            <Alert tone="rose">That plan is not available. Choose Starter, Business, or Pro.</Alert>
          ) : null}
          {shopify && params.checkout === "success" ? (
            <Alert tone="emerald">Subscription updated.</Alert>
          ) : null}
          {e.grantedByAdmin ? (
            <Alert tone="amber">Complimentary paid access is active on this workspace.</Alert>
          ) : null}
          {e.status === "TRIALING" && !e.grantedByAdmin ? (
            <Alert tone="amber">
              {wix
                ? "Trial active — billing starts when it ends."
                : shopify
                  ? "Trial active — billing starts when it ends unless you cancel."
                  : "Trial active — you’ll be charged when it ends unless you cancel."}
            </Alert>
          ) : null}
          {e.cancelAtPeriodEnd ? (
            <Alert tone="amber">Cancellation scheduled. Paid features stay until the period ends.</Alert>
          ) : null}
          {e.billingIssue ? (
            <Alert tone="amber">
              {shopify
                ? "There’s a payment issue on this subscription. Update billing in Shopify."
                : "There’s a payment issue on this plan. Update your card in Manage billing."}
            </Alert>
          ) : null}
          {webflow && !e.isPaidSeat && !cardReady && !needsPlanPick ? (
            <Alert tone="neutral">Paid upgrades aren’t available yet. You can continue on Free.</Alert>
          ) : null}
        </div>
      ) : null}

      {shopify ? (
        <ShopifyBillingPlans
          currentPlanKey={e.planKey}
          isPaidSeat={e.isPaidSeat}
          pricing={pricing}
          scopes={scopes}
          needsPlanPick={needsPlanPick}
        />
      ) : webflow ? (
        <WebflowBillingPlans
          currentPlanKey={e.planKey}
          isPaidSeat={e.isPaidSeat}
          pricing={pricing}
          scopes={scopes}
          needsPlanPick={needsPlanPick}
          checkoutReady={checkoutReady}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAID_PLANS.map((key) => {
            const current = e.planKey === key && e.isPaidSeat;
            const price = pricing.plans[key];
            const monthly = formatListedPrice(price.monthly, pricing.symbol);
            const yearly = formatListedPrice(price.yearly, pricing.symbol);
            const bullets = bulletsForPlatform(platform, bulletsForPlanScope(key, scopes[key]))
              .filter((item) => !/7-day/i.test(item))
              .slice(0, 5);
            const planParam = key === "GROWTH" ? "BUSINESS" : key;
            const checkoutHref = !checkoutReady
              ? null
              : `/api/billing/checkout?plan=${planParam}`;
            return (
              <div key={key} className={`panel p-5 ${current ? "amber-ring" : ""}`}>
                <p className="text-[11px] uppercase tracking-[0.14em] text-navy-300">
                  {current ? "Current" : "Package"}
                </p>
                <p className="mt-2 font-display text-2xl text-white">{planLabel(key)}</p>
                <p className="mt-2 text-xl text-amber-200">
                  {monthly ? (
                    <>
                      {monthly}
                      <span className="text-sm font-normal text-navy-300"> / mo</span>
                    </>
                  ) : (
                    <span className="text-base text-navy-400">Price on request</span>
                  )}
                </p>
                {yearly ? <p className="mt-0.5 text-xs text-navy-400">{yearly} / year</p> : null}
                <ul className="mt-4 space-y-2 text-sm text-navy-200">
                  {bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {checkoutHref ? (
                  <a href={checkoutHref} className="btn-secondary mt-5 inline-flex">
                    {current ? "Manage in Wix" : `Start ${planLabel(key)}`}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "rose" | "amber" | "emerald" | "neutral";
}) {
  const styles =
    tone === "rose"
      ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
      : tone === "emerald"
        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
        : tone === "amber"
          ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
          : "border-white/10 bg-white/5 text-navy-200";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
