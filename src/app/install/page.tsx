import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { legalLinkClass } from "@/components/marketing/LegalShell";
import { installGuideFor } from "@/modules/platforms/install-guide";

export const metadata: Metadata = {
  title: "Install guide — tidyAgent",
  description: "Choose your marketplace to see tidyAgent install steps and permissions.",
};

export default async function InstallIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const params = await searchParams;
  const focus = installGuideFor(params.platform);
  if (focus) redirect(`/install/${focus.id}`);

  return (
    <AuroraScene>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070B14]/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <Logo href="/" />
          <Link href="/" className="text-sm text-navy-200 transition hover:text-white">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">Setup</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white">
          Install &amp; permissions
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-navy-200">
          Each marketplace has its own install flow and permission set. Open the guide for the platform you are
          installing — they are completely separate.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/install/webflow"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-amber-400/40 hover:bg-amber-500/5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Webflow</p>
            <p className="mt-3 font-display text-2xl text-white">Webflow install guide</p>
            <p className="mt-2 text-sm leading-6 text-navy-300">
              Marketplace / Designer Extension, Data Client scopes, Custom Code widget, Data APIs only.
            </p>
            <span className={`mt-4 inline-block text-sm ${legalLinkClass}`}>Open Webflow guide →</span>
          </Link>
          <Link
            href="/install/shopify"
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-amber-400/40 hover:bg-amber-500/5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">Shopify</p>
            <p className="mt-3 font-display text-2xl text-white">Shopify install guide</p>
            <p className="mt-2 text-sm leading-6 text-navy-300">
              App Store install, Admin API scopes, script tag widget, Shopify Billing.
            </p>
            <span className={`mt-4 inline-block text-sm ${legalLinkClass}`}>Open Shopify permissions →</span>
            <span className="mt-2 block text-xs text-navy-400">
              Full guide:{" "}
              <span className="text-amber-300">/docs/shopify</span>
            </span>
          </Link>
        </div>
      </main>
    </AuroraScene>
  );
}
