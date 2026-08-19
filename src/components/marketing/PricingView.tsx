import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";

type PlanCard = {
  key: string;
  name: string;
  features: string[];
  href: string | null;
};

export function PricingView({
  plans,
  installed,
  error,
}: {
  plans: PlanCard[];
  installed: boolean;
  error?: string;
}) {
  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <Link href="/login" className="text-sm text-navy-200 transition hover:text-white">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">Wix checkout</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-white sm:text-5xl">Plans</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-navy-200">
          Every paid plan includes a <span className="text-white">7-day free trial</span>. Wix collects payment. After
          trial, the first charge has no extra webhook — opening tidyAgent refreshes the seat.
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            We could not start Wix checkout. Install the app first, then use Upgrade from Wix Manage Apps.
          </p>
        ) : null}
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.key} className="panel p-6">
              <p className="font-display text-3xl text-white">{plan.name}</p>
              <p className="mt-2 text-sm text-navy-300">7-day free trial, then Wix billing</p>
              <ul className="mt-5 space-y-2 text-sm text-navy-200">
                {plan.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {plan.href ? (
                <a href={plan.href} className="btn-primary mt-6 inline-flex">
                  Start {plan.name} trial
                </a>
              ) : (
                <p className="mt-6 text-sm text-navy-300">
                  Install tidyAgent on your Wix site, then choose a plan from Manage Apps → Upgrade.
                </p>
              )}
            </div>
          ))}
        </div>
        {!installed ? (
          <p className="mt-8 text-sm text-navy-400">
            This page is the Wix “external pricing page”. Paste{" "}
            <code className="text-navy-100">https://agent.tidyfloawapp.com/pricing</code> into Pricing and upgrade page
            URL.
          </p>
        ) : null}
      </main>
    </AuroraScene>
  );
}
