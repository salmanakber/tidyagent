"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  MessagesSquare,
  ShieldCheck,
  Store,
  Workflow,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { WidgetSimulator } from "@/components/marketing/WidgetSimulator";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Never invents an answer",
    body: "Grounded in your site, your FAQ, and live Wix data. If it isn’t sure, it says so — and loops in your team instead of guessing.",
  },
  {
    icon: Workflow,
    title: "Acts, not just answers",
    body: "Checks orders, looks up bookings, and searches your catalog through real Wix APIs — so customers get a resolution, not a paragraph.",
  },
  {
    icon: MessagesSquare,
    title: "Knows when to hand off",
    body: "A frustrated customer, a refund, or a gap in knowledge — tidyAgent recognizes the moment and brings a person in with full context.",
  },
];

const SETUP_STEPS = [
  { n: "01", title: "Create an account", body: "Email or Google. You start with an empty workspace — not a sample store." },
  { n: "02", title: "Install on Wix", body: "We identify the site and keep it tenant-isolated from day one." },
  { n: "03", title: "Answer a few questions", body: "Only what we can’t infer from the website itself." },
  { n: "04", title: "Publish", body: "Your AI employee is live, in your brand, on your site." },
];

const VERTICALS = [
  {
    icon: Store,
    name: "Ecommerce",
    points: ["Catalog search & stock", "Orders and returns", "Product recommendations"],
  },
  {
    icon: Workflow,
    name: "Cleaning & field services",
    points: ["Service-area checks", "Quote requests", "Booking assistance"],
  },
  {
    icon: CalendarCheck,
    name: "Bookings & clinics",
    points: ["Appointment scheduling", "Hours & location", "New-patient leads"],
  },
  {
    icon: MessagesSquare,
    name: "Real estate",
    points: ["Property comparison", "Viewing scheduling", "Lead qualification"],
  },
];

export function Landing() {
  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <nav className="hidden items-center gap-8 text-[13px] text-navy-300 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm text-navy-200 transition hover:text-white sm:inline">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary px-4 py-2 text-[13px]">
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section
          id="product"
          className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14 lg:pb-28 lg:pt-16"
        >
          <div>
            <p className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-amber-300 uppercase">
              AI employee for Wix
            </p>
            <h1 className="mt-5 max-w-xl font-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-[3.5rem]">
              Your site. Your brand.
              <span className="mt-1 block bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                An employee who never clocks out.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-7 text-navy-200">
              tidyAgent learns from your Wix site, then answers, acts, and hands off like a teammate. The chat
              widget wears their colors — never ours.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className="btn-primary group">
                Get started
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/pricing" className="btn-secondary">
                View plans
              </Link>
            </div>
            <ul className="mt-8 space-y-2.5">
              {["Tenant-isolated by design", "Evidence-based answers only", "Human handoff built in"].map((point) => (
                <li key={point} className="flex items-center gap-2.5 text-sm text-navy-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="relative">
              <WidgetSimulator />
            </div>
            <p className="relative mt-3 text-center text-[12px] text-navy-300">
              Demo on a customer site — widget colors belong to the business, not tidyAgent.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="max-w-2xl">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-amber-300">Why it&apos;s different</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-[2.4rem]">
              An employee customers can trust, and you can audit.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/15">
                  <feature.icon className="h-5 w-5 text-amber-300" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-navy-300">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="px-5 pb-24">
          <div className="mx-auto max-w-6xl rounded-[32px] border border-white/10 bg-white/[0.03] px-6 py-14 backdrop-blur-xl sm:px-10">
            <div className="max-w-2xl">
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-amber-300">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-[2.4rem]">
                Website to AI employee in a few minutes.
              </h2>
            </div>
            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {SETUP_STEPS.map((step, index) => (
                <li key={step.n} className="relative">
                  {index < SETUP_STEPS.length - 1 ? (
                    <span className="pointer-events-none absolute left-12 top-4 hidden h-px w-[calc(100%-1.5rem)] bg-gradient-to-r from-amber-400/70 to-transparent lg:block" />
                  ) : null}
                  <span className="font-display text-sm text-amber-300">{step.n}</span>
                  <h3 className="mt-3 text-base font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-navy-300">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="built-for" className="mx-auto max-w-6xl px-5 pb-24">
          <div className="max-w-2xl">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-amber-300">Built for you</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-[2.4rem]">
              The same employee, tuned to how you actually run.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {VERTICALS.map((vertical) => (
              <div key={vertical.name} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-navy">
                    <vertical.icon className="h-4 w-4 text-amber-100" />
                  </span>
                  <h3 className="text-base font-semibold text-white">{vertical.name}</h3>
                </div>
                <ul className="mt-5 space-y-2">
                  {vertical.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm text-navy-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="relative overflow-hidden rounded-[32px] bg-amber-navy px-8 py-12 text-center sm:px-16 sm:py-16">
            <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-8 bottom-0 h-48 w-48 rounded-full bg-navy-950/40 blur-3xl" />
            <p className="relative text-[12px] font-medium uppercase tracking-[0.16em] text-amber-100">Ready when you are</p>
            <h2 className="relative mx-auto mt-3 max-w-xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Hire the teammate who already knows your catalog.
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-sm leading-6 text-amber-50/80">
              Create a workspace, connect Wix, and publish. No sample data, no prompt engineering.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-amber-50">
                Create account
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
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
