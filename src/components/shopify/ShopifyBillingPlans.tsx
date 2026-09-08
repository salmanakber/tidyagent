import { planLabel } from "@/modules/billing/catalog";
import type { DisplayPricing } from "@/modules/billing/display-prices";
import { formatListedPrice } from "@/modules/billing/platform-prices";
import type { PlanKey } from "@prisma/client";
import type { PlanScopeConfig } from "@/modules/billing/plan-scopes";
import { bulletsForPlanScope } from "@/modules/billing/plan-scopes";
import { bulletsForPlatform } from "@/modules/platforms/copy";

const PAID_PLANS = ["STARTER", "GROWTH", "PRO"] as const;

/**
 * Shopify-only plan picker. Links use target="_top" so the charge confirmation
 * page opens in Shopify Admin (not stuck inside the embedded app iframe).
 */
export function ShopifyBillingPlans({
  currentPlanKey,
  isPaidSeat,
  pricing,
  scopes,
}: {
  currentPlanKey: string;
  isPaidSeat: boolean;
  pricing: DisplayPricing;
  scopes: Record<PlanKey, PlanScopeConfig>;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-transparent px-5 py-4 text-sm text-navy-200">
        Checkout opens Shopify’s native charge approval screen. Approve there to unlock the plan — invoices stay in
        Shopify Admin.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PAID_PLANS.map((key) => {
          const current = currentPlanKey === key && isPaidSeat;
          const featured = key === "GROWTH" && !current;
          const price = pricing.plans[key];
          const monthly = formatListedPrice(price.monthly, pricing.symbol);
          const yearly = formatListedPrice(price.yearly, pricing.symbol);
          const bullets = bulletsForPlatform("SHOPIFY", bulletsForPlanScope(key, scopes[key]));
          const planParam = key === "GROWTH" ? "BUSINESS" : key;
          const canCheckout = Boolean(monthly);
          const checkoutHref = canCheckout ? `/api/billing/shopify/checkout?plan=${planParam}` : null;

          return (
            <div
              key={key}
              className={`relative flex flex-col rounded-3xl border p-6 transition ${
                current
                  ? "border-amber-400/40 bg-amber-500/10 amber-ring"
                  : featured
                    ? "border-emerald-400/35 bg-white/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,0.12)]"
                    : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {featured ? (
                <span className="absolute -top-3 left-5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  Most chosen
                </span>
              ) : null}

              <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">
                {current ? "Current plan" : "Package"}
              </p>
              <p className="mt-3 font-display text-3xl text-white">{planLabel(key)}</p>

              <p className="mt-3 text-2xl text-amber-200">
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
                <p className="mt-2 inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-navy-200">
                  {pricing.trialDays}-day trial · billed in Shopify
                </p>
              ) : null}

              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-navy-200">
                {bullets
                  .filter((item) => !/7-day/i.test(item))
                  .map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>

              {checkoutHref ? (
                <a
                  href={checkoutHref}
                  target="_top"
                  rel="noopener"
                  className={`mt-6 inline-flex w-full items-center justify-center ${
                    current || featured ? "btn-primary" : "btn-secondary"
                  }`}
                >
                  {current ? "Change plan in Shopify" : `Start ${planLabel(key)} in Shopify`}
                </a>
              ) : (
                <p className="mt-6 text-xs text-navy-400">Shopify price not set yet. Ask the app owner to publish list prices.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
