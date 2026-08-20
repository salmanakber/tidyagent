import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";

export const LEGAL_UPDATED = "August 20, 2026";
export const LEGAL_CONTACT = "support@tidyflowapp.com";
export const LEGAL_SITE = "https://agent.tidyflowapp.com";

export function LegalShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
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
        <p className="mt-3 text-sm text-navy-400">Last updated {LEGAL_UPDATED}</p>
        <div className="legal-prose mt-10 space-y-8 text-[15px] leading-7 text-navy-200">{children}</div>
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-[12px] text-navy-400">
          <Logo compact href="/" />
          <div className="flex gap-5">
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
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
