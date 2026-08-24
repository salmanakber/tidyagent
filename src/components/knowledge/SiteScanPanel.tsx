"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Radar } from "lucide-react";
import { runSiteScan } from "@/app/actions/workspace";
import type { ScanResult, SiteUnderstanding } from "@/modules/knowledge/types";
import { cn } from "@/lib/utils";
import { wizardCopyForPlatform } from "@/modules/platforms/copy";

export function SiteScanPanel({
  planLabel,
  scopeNote,
  siteUrl,
  initial,
  onComplete,
  platform,
}: {
  planLabel: string;
  scopeNote: string;
  siteUrl?: string | null;
  initial?: ScanResult | null;
  onComplete?: (result: ScanResult) => void;
  platform?: string | null;
}) {
  const copy = wizardCopyForPlatform(platform);
  const stages = copy.scanStages;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ScanResult | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [fullSite, setFullSite] = useState(true);

  function run() {
    setError(null);
    setTick(0);
    const timer = window.setInterval(() => setTick((value) => value + 1), 1400);
    startTransition(async () => {
      try {
        const next = await runSiteScan({ fullSite });
        setResult(next);
        onComplete?.(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        window.clearInterval(timer);
      }
    });
  }

  const understanding = result?.understanding;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">{planLabel} scan scope</p>
        <p className="mt-2 text-sm leading-6 text-navy-100">{scopeNote}</p>
        {siteUrl ? (
          <p className="mt-2 truncate text-xs text-navy-400">{siteUrl}</p>
        ) : (
          <p className="mt-2 text-xs text-rose-200">{copy.noUrl}</p>
        )}
        <label className="mt-4 flex items-start gap-3 text-sm text-navy-100">
          <input
            type="checkbox"
            className="mt-1"
            checked={fullSite}
            onChange={(event) => setFullSite(event.target.checked)}
            disabled={pending}
          />
          <span>
            Crawl every public page we can find
            <span className="mt-1 block text-xs text-navy-400">
              {copy.crawlHint}
            </span>
          </span>
        </label>
      </div>

      {pending ? (
        <div className="space-y-3">
          {stages.map((label, index) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                {index <= tick % stages.length ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Radar className="h-3.5 w-3.5" />
                )}
              </span>
              <span className={index <= tick ? "text-white" : "text-navy-400"}>{label}</span>
            </div>
          ))}
          <p className="text-xs text-navy-400">This reads the live site. It is not a canned demo.</p>
        </div>
      ) : null}

      {result ? <ScanSummary result={result} understanding={understanding} /> : null}

      {error ? (
        <p className="flex items-center gap-2 text-sm text-rose-300">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      ) : null}

      <button className="btn-primary" onClick={run} disabled={pending}>
        {pending ? "Reading website…" : result ? "Re-run scanner" : "Read and understand this website"}
      </button>
    </div>
  );
}

function ScanSummary({
  result,
  understanding,
}: {
  result: ScanResult;
  understanding?: SiteUnderstanding | null;
}) {
  const leftover = (result.crawl ?? []).filter((item) => item.origin === "website" && item.status !== "crawled").length;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {result.stages.map((stage) => (
          <div key={stage.key} className="flex items-start gap-3 rounded-2xl bg-navy-950/40 px-4 py-3 text-sm">
            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", stage.status === "done" ? "text-emerald-300" : stage.status === "skipped" ? "text-navy-500" : "text-rose-300")} />
            <div>
              <p className="text-white">{stage.label}</p>
              <p className="text-xs text-navy-400">{stage.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {result.counts.pages > 0 ? <Stat label="Pages crawled" value={result.counts.pages} /> : null}
        {result.counts.products > 0 ? <Stat label="Store products" value={result.counts.products} /> : null}
        {leftover > 0 ? <Stat label="Found, not yet read" value={leftover} /> : null}
        {result.counts.faqs > 0 ? <Stat label="FAQs" value={result.counts.faqs} /> : null}
      </div>
      {understanding ? (
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-navy-400">Business understanding</p>
          <p className="mt-2 font-display text-xl text-white">{understanding.name}</p>
          <p className="mt-2 text-sm leading-6 text-navy-200">{understanding.summary}</p>
        </div>
      ) : null}
      {result.warnings.length ? (
        <ul className="space-y-1 text-xs text-amber-200">
          {result.warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {result.skipped.length ? (
        <ul className="space-y-1 text-xs text-navy-400">
          {result.skipped.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-navy-950/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-navy-400">{label}</p>
      <p className="mt-1 font-display text-2xl text-white">{value}</p>
    </div>
  );
}
