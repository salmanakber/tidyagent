import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { legalLinkClass } from "@/components/marketing/LegalShell";
import { legalHref } from "@/modules/legal/platform";
import {
  INSTALL_GUIDES,
  installGuideFor,
  type InstallGuide,
} from "@/modules/platforms/install-guide";

export const metadata: Metadata = {
  title: "Install guide — tidyAgent",
  description: "How to install tidyAgent on Webflow and Shopify, and which permissions we request.",
};

export default async function InstallGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const params = await searchParams;
  const focus = installGuideFor(params.platform);
  const guides = focus ? [focus, ...INSTALL_GUIDES.filter((g) => g.id !== focus.id)] : [...INSTALL_GUIDES];

  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <div className="flex items-center gap-4 text-sm text-navy-200">
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">Setup</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white">
          Install &amp; permissions
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-navy-200">
          tidyAgent connects to your Webflow site or Shopify store, learns from published content (and plan-scoped
          catalog data), and adds a chat widget for visitors. Below is how to install and why each permission is
          requested.
        </p>

        <p className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-navy-400">
          <span>Jump to:</span>
          <a href="#webflow" className={legalLinkClass}>
            Webflow
          </a>
          <a href="#shopify" className={legalLinkClass}>
            Shopify
          </a>
        </p>

        <div className="mt-12 space-y-16">
          {guides.map((guide) => (
            <PlatformInstallSection key={guide.id} guide={guide} />
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[12px] text-navy-400">
          <Logo compact href="/" />
          <div className="flex gap-5">
            <Link href="/install" className="transition hover:text-white">
              Install
            </Link>
            <Link href={legalHref("/terms", "WEBFLOW")} className="transition hover:text-white">
              Terms
            </Link>
            <Link href={legalHref("/privacy", "WEBFLOW")} className="transition hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </AuroraScene>
  );
}

function PlatformInstallSection({ guide }: { guide: InstallGuide }) {
  return (
    <section id={guide.id} className="scroll-mt-24 space-y-8">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-300">{guide.name}</p>
        <h2 className="mt-2 font-display text-2xl text-white">How to install on {guide.name}</h2>
        <p className="mt-3 text-[15px] leading-7 text-navy-200">{guide.summary}</p>
        {guide.startHref ? (
          <Link
            href={guide.startHref}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-amber-300"
          >
            {guide.startLabel}
          </Link>
        ) : null}
      </div>

      <div>
        <h3 className="font-display text-lg text-white">Steps</h3>
        <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[15px] leading-7 text-navy-200">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="font-display text-lg text-white">Permissions we request</h3>
        <p className="mt-2 text-sm text-navy-400">
          These match the OAuth scopes tidyAgent requests at install. Approve only if you are an admin on the{" "}
          {guide.name} {guide.id === "shopify" ? "store" : "site"}.
        </p>
        <ul className="mt-4 space-y-3">
          {guide.permissions.map((row) => (
            <li
              key={row.scope}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5"
            >
              <code className="text-[13px] font-medium text-amber-300">{row.scope}</code>
              <p className="mt-1.5 text-sm leading-6 text-navy-200">{row.why}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-display text-lg text-white">After install</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-navy-200">
          {guide.afterInstall.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-display text-lg text-white">Notes</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-navy-300">
          {guide.notes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
