"use client";

import {
  Bot,
  Code2,
  FileCode2,
  FileSpreadsheet,
  Globe2,
  ImageIcon,
  Lightbulb,
  MessageSquareQuote,
  MessagesSquare,
  Palette,
  Target,
} from "lucide-react";
import type { ScanResult } from "@/modules/knowledge/types";
import { cn } from "@/lib/utils";

export type CollectionCategory =
  | "pages"
  | "colors"
  | "images"
  | "phrases"
  | "intents"
  | "artifacts"
  | "topics"
  | "prompts";

type CategoryCard = {
  key: CollectionCategory;
  label: string;
  icon: typeof FileCode2;
  count: number;
  chips: string[];
  active?: boolean;
  filling?: boolean;
};

const CATEGORY_META: { key: CollectionCategory; label: string; icon: typeof FileCode2 }[] = [
  { key: "pages", label: "Pages", icon: FileCode2 },
  { key: "colors", label: "Colors", icon: Palette },
  { key: "images", label: "Images", icon: ImageIcon },
  { key: "phrases", label: "Phrases", icon: MessageSquareQuote },
  { key: "intents", label: "Intents", icon: Target },
  { key: "artifacts", label: "Artifacts", icon: FileSpreadsheet },
  { key: "topics", label: "Topics", icon: Lightbulb },
  { key: "prompts", label: "Prompts", icon: MessagesSquare },
];

const FLOW_STATUS = [
  "Connecting to website…",
  "Extracting pages & structure…",
  "Reading products & content…",
  "Building FAQs & topics…",
  "Creating AI context…",
];

export function buildCollectionFromScan(result: ScanResult | null | undefined): Record<CollectionCategory, { count: number; chips: string[] }> {
  if (!result) {
    return emptyCollection();
  }

  const u = result.understanding;
  const pageChips = (result.crawl ?? [])
    .filter((item) => item.status === "crawled" || item.origin !== "website")
    .map((item) => {
      try {
        const path = new URL(item.url).pathname || "/";
        return path.length > 28 ? `${path.slice(0, 26)}…` : path;
      } catch {
        return item.title?.slice(0, 24) || "page";
      }
    })
    .filter(Boolean)
    .slice(0, 4);

  const phraseChips = [...(u?.faqs ?? []), ...(u?.differentiators ?? [])].map(short).filter(Boolean).slice(0, 4);
  const topicChips = [u?.industry, u?.businessType, ...(u?.offerings ?? [])].filter(Boolean).map(short).slice(0, 4) as string[];
  const intentChips = ["support", "sales", "booking", "policies"].slice(0, Math.min(4, Math.max(1, (u?.faqs?.length ?? 0) > 0 ? 3 : 1)));
  const artifactChips = [
    ...(result.counts.products ? [`${result.counts.products} products`] : []),
    ...(result.counts.faqs ? [`${result.counts.faqs} FAQs`] : []),
    ...(result.counts.policies ? [`${result.counts.policies} policies`] : []),
    ...(result.counts.chunks ? [`${result.counts.chunks} chunks`] : []),
  ].slice(0, 4);
  const promptChips = [u?.tone ? `${u.tone} tone` : null, u?.audience ? short(u.audience) : null, "site context"].filter(Boolean) as string[];
  const colorChips = u?.tone ? [toneToSwatch(u.tone), "brand accents"] : [];
  const imageChips = result.counts.products > 0 ? [`${Math.min(result.counts.products, 12)} media`] : [];

  return {
    pages: { count: result.counts.pages || pageChips.length, chips: pageChips },
    colors: { count: colorChips.length, chips: colorChips },
    images: { count: imageChips.length ? Math.min(result.counts.products, 24) : 0, chips: imageChips },
    phrases: { count: phraseChips.length || (u?.faqs?.length ?? 0), chips: phraseChips },
    intents: { count: intentChips.length, chips: intentChips },
    artifacts: {
      count: (result.counts.products || 0) + (result.counts.faqs || 0) + (result.counts.policies || 0),
      chips: artifactChips,
    },
    topics: { count: topicChips.length, chips: topicChips },
    prompts: { count: promptChips.length, chips: promptChips },
  };
}

function emptyCollection(): Record<CollectionCategory, { count: number; chips: string[] }> {
  return {
    pages: { count: 0, chips: [] },
    colors: { count: 0, chips: [] },
    images: { count: 0, chips: [] },
    phrases: { count: 0, chips: [] },
    intents: { count: 0, chips: [] },
    artifacts: { count: 0, chips: [] },
    topics: { count: 0, chips: [] },
    prompts: { count: 0, chips: [] },
  };
}

function short(value: string, max = 22) {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function toneToSwatch(tone: string) {
  const t = tone.toLowerCase();
  if (t.includes("warm") || t.includes("friendly")) return "warm neutrals";
  if (t.includes("professional") || t.includes("formal")) return "cool neutrals";
  if (t.includes("bold") || t.includes("playful")) return "vivid accents";
  return "site palette";
}

/** Simulated fill while scan is running — unlocks categories in sequence. */
export function animatedCollection(tick: number): Record<CollectionCategory, { count: number; chips: string[]; filling: boolean; active: boolean }> {
  const order = CATEGORY_META.map((c) => c.key);
  const unlocked = Math.min(order.length, Math.floor(tick / 1) + 1);
  const out = {} as Record<CollectionCategory, { count: number; chips: string[]; filling: boolean; active: boolean }>;

  order.forEach((key, index) => {
    const filling = index === unlocked - 1;
    const done = index < unlocked - 1;
    const active = index <= unlocked - 1;
    const fakeCount = done ? Math.max(1, (index * 2 + tick) % 5) : filling ? Math.max(0, tick % 4) : 0;
    const chips = done || filling
      ? Array.from({ length: Math.min(3, Math.max(1, fakeCount || 1)) }, (_, i) => (key === "pages" ? ["/", "/about", "/services", "/contact"][i] || `…` : "····"))
      : [];
    out[key] = {
      count: fakeCount,
      chips: key === "pages" && (done || filling) ? chips.filter((c) => c !== "····") : chips.map(() => ""),
      filling,
      active,
    };
  });

  return out;
}

export function KnowledgeCollectionBoard({
  result,
  pending,
  tick,
  siteUrl,
  progressLabel,
}: {
  result?: ScanResult | null;
  pending?: boolean;
  tick?: number;
  siteUrl?: string | null;
  progressLabel?: string;
}) {
  const t = tick ?? 0;
  const live = pending ? animatedCollection(t) : null;
  const collected = buildCollectionFromScan(result);
  const progress = pending ? Math.min(92, 12 + t * 11) : result?.ok ? 100 : 0;
  const statusText = pending
    ? FLOW_STATUS[Math.min(FLOW_STATUS.length - 1, t % FLOW_STATUS.length)]
    : result?.ok
      ? "AI context ready"
      : "Waiting to collect site knowledge";

  const cards: CategoryCard[] = CATEGORY_META.map((meta) => {
    if (live) {
      const row = live[meta.key];
      return {
        ...meta,
        count: row.count,
        chips: row.chips,
        active: row.active,
        filling: row.filling,
      };
    }
    const row = collected[meta.key];
    return {
      ...meta,
      count: row.count,
      chips: row.chips,
      active: row.count > 0,
      filling: false,
    };
  });

  return (
    <div className="space-y-5">
      <ScanStatusFlow
        pending={Boolean(pending)}
        done={Boolean(result?.ok)}
        siteUrl={siteUrl}
        progress={progress}
        statusText={progressLabel || statusText}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <CollectionCard key={card.key} card={card} delay={index * 40} />
        ))}
      </div>
    </div>
  );
}

function CollectionCard({ card, delay }: { card: CategoryCard; delay: number }) {
  const Icon = card.icon;
  const empty = card.count === 0 && !card.filling;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-navy-900/80 transition duration-300",
        card.active || card.filling
          ? "border-amber-500/35 shadow-[0_0_0_1px_rgba(201,100,66,0.08)]"
          : "border-white/10",
        card.filling && "amber-ring",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-3.5 py-3">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            card.active || card.filling ? "bg-amber-500/15 text-amber-400" : "bg-white/5 text-navy-400",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{card.label}</p>
        <span
          className={cn(
            "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
            card.count > 0 || card.filling ? "bg-amber-500 text-white" : "bg-white/10 text-navy-400",
          )}
        >
          {card.count}
        </span>
      </div>
      <div className={cn("relative h-[1px] w-full bg-white/10", (card.active || card.filling) && "after:absolute after:inset-y-0 after:left-0 after:w-1/3 after:bg-amber-500")} />
      <div className="min-h-[76px] space-y-2 px-3.5 py-3">
        {empty ? (
          <div className="space-y-2 pt-0.5">
            <div className="h-6 w-[72%] rounded-lg bg-white/10" />
            <div className="h-6 w-[54%] rounded-lg bg-white/5" />
            <div className="h-6 w-[40%] rounded-lg bg-white/[0.04]" />
          </div>
        ) : card.filling && card.chips.every((c) => !c) ? (
          <div className="space-y-2 pt-0.5">
            <div className="h-6 w-[68%] rounded-lg collect-shimmer" />
            <div className="h-6 w-[48%] rounded-lg collect-shimmer" />
            <div className="h-6 w-[36%] rounded-lg collect-shimmer" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {card.chips.slice(0, 4).map((chip, i) =>
              chip ? (
                <span
                  key={`${card.key}-${chip}-${i}`}
                  className="animate-card-fill rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-100"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {chip}
                </span>
              ) : (
                <span key={`${card.key}-ph-${i}`} className="h-6 w-16 rounded-lg collect-shimmer" />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScanStatusFlow({
  pending,
  done,
  siteUrl,
  progress,
  statusText,
}: {
  pending: boolean;
  done: boolean;
  siteUrl?: string | null;
  progress: number;
  statusText: string;
}) {
  let host = "Website";
  try {
    if (siteUrl) host = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    /* keep default */
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-navy-850/90 to-navy-950/90 shadow-card">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-400">Current status</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            pending
              ? "bg-amber-500/15 text-amber-300"
              : done
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/10 text-navy-300",
          )}
        >
          {pending ? "Running" : done ? "Complete" : "Ready"}
        </span>
      </div>

      <div className="relative px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute inset-x-8 top-1/2 hidden h-px -translate-y-8 border-t border-dashed border-white/15 md:block" />

        <div className="relative grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
          <div className="relative rounded-2xl border border-white/10 bg-navy-900/90 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                <Globe2 className="h-4 w-4" />
              </span>
              {pending ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  · Extracting…
                </span>
              ) : done ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  · Synced
                </span>
              ) : null}
            </div>
            <p className="font-display text-lg text-white">{host}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">Source data</p>
          </div>

          <div className="flex items-center justify-center gap-2 md:flex-col md:py-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-900 px-2.5 py-1 text-[11px] text-navy-200">
              <Code2 className="h-3 w-3 text-amber-400" />
              {pending ? "…" : done ? "200 OK" : "idle"}
            </span>
            <span className="hidden h-8 w-8 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 md:flex">
              <Code2 className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="relative rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-navy-900/90 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                <Bot className="h-4 w-4" />
              </span>
              <span className="text-amber-400/80">✦</span>
            </div>
            <p className="font-display text-lg text-white">tidyAgent</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">AI context</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="truncate text-sm text-navy-100">{statusText}</p>
          <p className="shrink-0 font-display text-sm text-amber-300">{Math.round(progress)}%</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              "h-full rounded-full bg-amber-500 transition-[width] duration-700 ease-out",
              pending && "shadow-glow",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
