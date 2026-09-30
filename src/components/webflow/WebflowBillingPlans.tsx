import { planLabel } from "@/modules/billing/catalog";
import type { DisplayPricing } from "@/modules/billing/display-prices";
import { formatListedPrice } from "@/modules/billing/platform-prices";
import type { PlanKey } from "@prisma/client";
import type { PlanScopeConfig } from "@/modules/billing/plan-scopes";
import { bulletsForPlanScope } from "@/modules/billing/plan-scopes";
import { bulletsForPlatform } from "@/modules/platforms/copy";
import { continueFreePlan } from "@/app/actions/workspace";

const ALL_PLANS = ["FREE", "STARTER", "GROWTH", "PRO"] as const;

/** Webflow plan picker — Free locally, paid via Stripe checkout. */
export function WebflowBillingPlans({
  currentPlanKey,
  isPaidSeat,
  pricing,
  scopes,
  needsPlanPick = false,
  checkoutReady,
}: {
  currentPlanKey: string;
  isPaidSeat: boolean;
  pricing: DisplayPricing;
  scopes: Record<PlanKey, PlanScopeConfig>;
  needsPlanPick?: boolean;
  checkoutReady: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {ALL_PLANS.map((key) => {
        const free = key === "FREE";
        const showingCurrent = free ? currentPlanKey === "FREE" : currentPlanKey === key && isPaidSeat;
        const featured = key === "GROWTH" && !showingCurrent;
        const price = free ? null : pricing.plans[key];
        const monthly = price ? formatListedPrice(price.monthly, pricing.symbol) : null;
        const yearly = price ? formatListedPrice(price.yearly, pricing.symbol) : null;
        const bullets = bulletsForPlatform("WEBFLOW", bulletsForPlanScope(key, scopes[key]))
          .filter((item) => !/7-day/i.test(item))
          .slice(0, 5);
        const planParam = key === "GROWTH" ? "BUSINESS" : key;
        const checkoutHref =
          !free && checkoutReady && monthly ? `/api/billing/stripe/checkout?plan=${planParam}` : null;

        return (
          <div
            key={key}
            className={`relative flex flex-col rounded-2xl border p-5 transition ${
              showingCurrent || (needsPlanPick && free)
                ? "border-amber-400/40 bg-amber-500/10 amber-ring"
                : featured
                  ? "border-emerald-400/30 bg-white/[0.05]"
                  : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {featured ? (
              <span className="absolute -top-2.5 left-4 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                Popular
              </span>
            ) : null}

            <p className="text-[11px] uppercase tracking-[0.14em] text-navy-300">
              {showingCurrent && !needsPlanPick ? "Current" : free ? "Included" : "Paid"}
            </p>
            <p className="mt-2 font-display text-2xl text-white">{planLabel(key)}</p>
            <p className="mt-2 text-xl text-amber-200">
              {free ? (
                <>
                  $0<span className="text-sm font-normal text-navy-300"> / forever</span>
                </>
              ) : monthly ? (
                <>
                  {monthly}
                  <span className="text-sm font-normal text-navy-300"> / mo</span>
                </>
              ) : (
                <span className="text-base text-navy-400">Price on request</span>
              )}
            </p>
            {yearly ? <p className="mt-0.5 text-xs text-navy-400">{yearly} / year</p> : null}

            <ul className="mt-4 flex-1 space-y-2 text-sm text-navy-200">
              {bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/70" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {free ? (
              needsPlanPick ? (
                <form action={continueFreePlan} className="mt-5">
                  <button type="submit" className="btn-primary w-full">
                    Continue with Free
                  </button>
                </form>
              ) : (
                <p
                  className={`mt-5 inline-flex w-full items-center justify-center rounded-full border px-3 py-2 text-sm ${
                    showingCurrent
                      ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
                      : "border-white/10 bg-white/5 text-navy-300"
                  }`}
                >
                  {showingCurrent ? "You’re on Free" : "Cancel paid plan to return"}
                </p>
              )
            ) : checkoutHref ? (
              <a
                href={checkoutHref}
                className={`mt-5 inline-flex w-full items-center justify-center ${
                  showingCurrent || featured ? "btn-primary" : "btn-secondary"
                }`}
              >
                {showingCurrent ? "Change plan" : `Start ${planLabel(key)}`}
              </a>
            ) : (
              <p className="mt-5 text-xs text-navy-400">Checkout not ready yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
