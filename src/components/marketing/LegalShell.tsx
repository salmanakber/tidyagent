import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";
import { legalHref } from "@/modules/legal/platform";
import { platformLabel, type SitePlatform } from "@/modules/platforms/types";

export const LEGAL_UPDATED = "August 25, 2026";
export const LEGAL_CONTACT = "support@tidyflowapp.com";
export const LEGAL_SITE = "https://agent.tidyflowapp.com";

/** In-content / footer links that stay readable on the dark AuroraScene. */
export const legalLinkClass = "text-amber-300 underline-offset-2 hover:underline";

export function LegalShell({
  eyebrow,
  title,
  platform = "WIX",
  children,
}: {
  eyebrow: string;
  title: string;
  platform?: SitePlatform;
  children: React.ReactNode;
}) {
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
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-sm text-navy-400">
          Last updated {LEGAL_UPDATED}
          <span className="mx-2 text-navy-500">·</span>
          {platformLabel(platform)} listing
        </p>
        <div className="legal-prose mt-10 space-y-8 text-[15px] leading-7 text-navy-200">{children}</div>
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[12px] text-navy-400">
          <Logo compact href="/" />
          <div className="flex gap-5">
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

export function LegalH({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl text-white">{children}</h2>;
}
