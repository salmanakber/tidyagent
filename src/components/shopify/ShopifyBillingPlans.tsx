import { planLabel } from "@/modules/billing/catalog";
import type { DisplayPricing } from "@/modules/billing/display-prices";
import { formatListedPrice } from "@/modules/billing/platform-prices";
import type { PlanKey } from "@prisma/client";
import type { PlanScopeConfig } from "@/modules/billing/plan-scopes";
import { bulletsForPlanScope } from "@/modules/billing/plan-scopes";
import { bulletsForPlatform } from "@/modules/platforms/copy";
import { ShopifyPlanCheckoutButton } from "@/components/shopify/ShopifyPlanCheckoutButton";
import { continueShopifyFreePlan } from "@/app/actions/workspace";

const ALL_PLANS = ["FREE", "STARTER", "GROWTH", "PRO"] as const;

/**
 * Shopify-only plan picker. Checkout fetches confirmationUrl inside the iframe
 * (session cookie stays valid), then opens Shopify Admin billing with target=_top.
 */
export function ShopifyBillingPlans({
  currentPlanKey,
  isPaidSeat,
  pricing,
  scopes,
  needsPlanPick = false,
}: {
  currentPlanKey: string;
  isPaidSeat: boolean;
  pricing: DisplayPricing;
  scopes: Record<PlanKey, PlanScopeConfig>;
  needsPlanPick?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-transparent px-5 py-4 text-sm text-navy-200">
        {needsPlanPick
          ? "Pick Free to continue setup, or approve a paid plan in Shopify. You can change plans later."
          : "Start on Free with limited store knowledge, or open Shopify’s charge approval screen for a paid plan."}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ALL_PLANS.map((key) => {
          const free = key === "FREE";
          const showingCurrent = free ? currentPlanKey === "FREE" : currentPlanKey === key && isPaidSeat;
          const featured = key === "GROWTH" && !showingCurrent;
          const price = free ? null : pricing.plans[key];
          const monthly = price ? formatListedPrice(price.monthly, pricing.symbol) : null;
          const yearly = price ? formatListedPrice(price.yearly, pricing.symbol) : null;
          const bullets = bulletsForPlatform("SHOPIFY", bulletsForPlanScope(key, scopes[key]));
          const planParam = key === "GROWTH" ? "BUSINESS" : key;
          const canCheckout = !free && Boolean(monthly);

          return (
            <div
              key={key}
              className={`relative flex flex-col rounded-3xl border p-6 transition ${
                showingCurrent || (needsPlanPick && free)
                  ? "border-amber-400/40 bg-amber-500/10 amber-ring"
                  : featured
                    ? "border-emerald-400/35 bg-white/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,0.12)]"
                    : free
                      ? "border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent"
                      : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {featured ? (
                <span className="absolute -top-3 left-5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  Most chosen
                </span>
              ) : free && needsPlanPick ? (
                <span className="absolute -top-3 left-5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-200">
                  No charge
                </span>
              ) : null}

              <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">
                {showingCurrent && !needsPlanPick ? "Current plan" : free ? "Included" : "Package"}
              </p>
              <p className="mt-3 font-display text-3xl text-white">{planLabel(key)}</p>

              <p className="mt-3 text-2xl text-amber-200">
                {free ? (
                  <>
                    $0
                    <span className="text-sm font-normal text-navy-300"> / forever</span>
                  </>
                ) : monthly ? (
                  <>
                    {monthly}
                    <span className="text-sm font-normal text-navy-300"> / month</span>
                  </>
                ) : (
                  <span className="text-lg text-navy-400">Price on request</span>
                )}
              </p>
              {yearly ? <p className="mt-1 text-sm text-navy-300">{yearly} / year</p> : null}
              {!free && pricing.trialDays > 0 ? (
                <p className="mt-2 inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-navy-200">
                  {pricing.trialDays}-day trial · billed in Shopify
                </p>
              ) : free ? (
                <p className="mt-2 inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-navy-200">
                  Limited store knowledge · upgrade anytime
                </p>
              ) : null}

              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-navy-200">
                {bullets
                  .filter((item) => !/7-day/i.test(item))
                  .map((item) => (
                    <li key={item} className="flex gap-2">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          free ? "bg-navy-300/80" : "bg-emerald-300/80"
                        }`}
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>

              {free ? (
                needsPlanPick ? (
                  <form action={continueShopifyFreePlan} className="mt-6">
                    <button type="submit" className="btn-primary w-full">
                      Continue with Free
                    </button>
                  </form>
                ) : (
                  <p
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-sm font-medium ${
                      showingCurrent
                        ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
                        : "border-white/10 bg-white/5 text-navy-200"
                    }`}
                  >
                    {showingCurrent ? "You’re on Free" : "Downgrade by cancelling in Shopify"}
                  </p>
                )
              ) : canCheckout ? (
                <ShopifyPlanCheckoutButton
                  planParam={planParam}
                  label={showingCurrent ? "Change plan in Shopify" : `Start ${planLabel(key)} in Shopify`}
                  className={`inline-flex w-full items-center justify-center disabled:opacity-60 ${
                    showingCurrent || featured ? "btn-primary" : "btn-secondary"
                  }`}
                />
              ) : (
                <p className="mt-6 text-xs text-navy-400">
                  Shopify price not set yet. Ask the app owner to publish list prices.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
