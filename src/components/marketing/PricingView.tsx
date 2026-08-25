"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { cn } from "@/lib/utils";

export type PricingCard = {
  key: string;
  name: string;
  features: string[];
  href: string | null;
  featured?: boolean;
  monthly: string | null;
  yearly: string | null;
};

export function PricingView({
  plans,
  trialDays,
  symbol,
  error,
}: {
  plans: PricingCard[];
  trialDays: number;
  symbol: string;
  error?: string;
}) {
  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <Link href="/login" className="text-sm text-navy-200 transition hover:text-white">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            {trialDays}-day free trial
          </p>
          <h1 className="mt-5 font-display text-[2.7rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
            An AI employee
            <span className="mt-1 block bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              that pays for itself.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-navy-200">
            Start free for {trialDays} days. Wix handles billing. Cancel anytime before the trial ends.
          </p>
        </div>

        {error ? (
          <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
            Checkout could not start. Open tidyAgent from your Wix dashboard and try again.
          </p>
        ) : null}

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.key}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-[28px] border p-7",
                plan.featured
                  ? "border-amber-400/40 bg-gradient-to-b from-amber-400/15 via-[#10182a] to-[#0b1220] shadow-[0_30px_80px_rgba(245,158,11,0.18)] lg:-translate-y-3"
                  : "border-white/10 bg-white/[0.04] backdrop-blur-xl",
              )}
            >
              {plan.featured ? (
                <span className="absolute right-5 top-5 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-950">
                  Most chosen
                </span>
              ) : null}
              <p className="text-sm font-medium text-navy-300">{plan.name}</p>
              <div className="mt-4 flex items-end gap-1.5">
                {plan.monthly ? (
                  <>
                    <span className="font-display text-5xl font-semibold tracking-tight text-white">
                      {symbol}
                      {plan.monthly}
                    </span>
                    <span className="mb-1.5 text-sm text-navy-400">/ month</span>
                  </>
                ) : (
                  <span className="font-display text-4xl text-white">Custom</span>
                )}
              </div>
              <p className="mt-2 text-sm text-navy-400">
                {trialDays} days free
                {plan.yearly ? ` · ${symbol}${plan.yearly} / year` : ""}
              </p>
              <ul className="mt-7 flex-1 space-y-3">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-navy-100">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              {plan.href ? (
                <a
                  href={plan.href}
                  className={cn("mt-8 inline-flex justify-center", plan.featured ? "btn-primary" : "btn-secondary")}
                >
                  Start free trial
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo compact href="/" />
          <div className="flex items-center gap-6 text-[12px] text-navy-400">
            <Link href="/install" className="transition hover:text-white">
              Install
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Sign in
            </Link>
          </div>
          <p className="text-[12px] text-navy-500">© {new Date().getFullYear()} tidyAgent</p>
        </div>
      </footer>
    </AuroraScene>
  );
}
