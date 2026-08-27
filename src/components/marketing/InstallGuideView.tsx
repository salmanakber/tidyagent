import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { legalHref } from "@/modules/legal/platform";
import type { InstallGuide } from "@/modules/platforms/install-guide";

export function InstallGuideView({ guide }: { guide: InstallGuide }) {
  const platform = guide.id === "shopify" ? "SHOPIFY" : "WEBFLOW";
  const docsHref = guide.id === "webflow" ? "/docs/webflow" : null;

  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <div className="flex items-center gap-4 text-sm text-navy-200">
            {docsHref ? (
              <Link href={docsHref} className="transition hover:text-white">
                User guide
              </Link>
            ) : null}
            <Link href="/install" className="transition hover:text-white">
              All platforms
            </Link>
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">{guide.name}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white">
          Install &amp; permissions
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-navy-200">{guide.summary}</p>
        {guide.startHref ? (
          <Link
            href={guide.startHref}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-amber-300"
          >
            {guide.startLabel}
          </Link>
        ) : null}

        <div className="mt-12 space-y-10">
          <section className="space-y-3">
            <h2 className="font-display text-xl text-white">Steps</h2>
            <ol className="list-decimal space-y-2.5 pl-5 text-[15px] leading-7 text-navy-200">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-white">Permissions we request</h2>
            <p className="text-sm text-navy-400">
              These match the OAuth scopes tidyAgent requests at install. Approve only if you are an admin on the{" "}
              {guide.name} {guide.id === "shopify" ? "store" : "site"}.
            </p>
            <ul className="mt-4 space-y-3">
              {guide.permissions.map((row) => (
                <li key={row.scope} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5">
                  <code className="text-[13px] font-medium text-amber-300">{row.scope}</code>
                  <p className="mt-1.5 text-sm leading-6 text-navy-200">{row.why}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-white">After install</h2>
            <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-navy-200">
              {guide.afterInstall.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-white">Notes</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-navy-300">
              {guide.notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[12px] text-navy-400">
          <Logo compact href="/" />
          <div className="flex gap-5">
            <Link href={`/install/${guide.id}`} className="transition hover:text-white">
              Install
            </Link>
            <Link href={legalHref("/terms", platform)} className="transition hover:text-white">
              Terms
            </Link>
            <Link href={legalHref("/privacy", platform)} className="transition hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </AuroraScene>
  );
}
