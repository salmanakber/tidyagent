import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { legalLinkClass } from "@/components/marketing/LegalShell";

export const dynamic = "force-dynamic";

/**
 * Shown after Webflow uninstall / disconnect.
 * Custom Code is already removed via API; merchant must publish for the live site to drop the widget.
 */
export default async function WebflowUninstalledPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string; error?: string }>;
}) {
  const params = await searchParams;
  const removed = params.removed !== "0";
  const error = params.error?.trim() || "";

  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <Link href="/docs/webflow" className="text-sm text-navy-200 transition hover:text-white">
            Guide
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-24 pt-14 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">Webflow</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {removed ? "tidyAgent Custom Code removed" : "Uninstall almost complete"}
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-navy-200">
          {removed
            ? "tidyAgent deleted the chat widget Custom Code it applied on your Webflow site. Unrelated scripts were left alone."
            : "tidyAgent could not reach Webflow to remove Custom Code automatically (token may already be revoked)."}
        </p>
        {error && !removed ? (
          <p className="mt-3 text-sm text-amber-200/90">Cleanup note: {error.replaceAll("_", " ")}</p>
        ) : null}

        <div className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-500/10 px-6 py-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Required next step</p>
          <p className="mt-3 text-[15px] leading-7 text-white">
            Publish your Webflow site so visitors stop loading the chat bubble.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-navy-200">
            <li>Open the site in Webflow.</li>
            <li>Click Publish (and publish to your live domains).</li>
            <li>Hard-refresh the live site to confirm the bubble is gone.</li>
          </ol>
          <a
            href="https://webflow.com/dashboard"
            className="btn-primary mt-6 inline-flex w-full justify-center"
            target="_blank"
            rel="noreferrer"
          >
            Open Webflow to publish
          </a>
        </div>

        <p className="mt-8 text-sm leading-6 text-navy-400">
          You can also revoke the app under Webflow Site settings → Apps &amp; integrations. tidyAgent already removed its
          applied Custom Code through the API while authorized.{" "}
          <Link href="/docs/webflow#disconnect" className={legalLinkClass}>
            Uninstall guide
          </Link>
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/webflow" className="btn-secondary">
            Reinstall tidyAgent
          </Link>
          <Link href="/" className="btn-secondary">
            Home
          </Link>
        </div>
      </main>
    </AuroraScene>
  );
}
