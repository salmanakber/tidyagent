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
import { isShopifyPlatform, isWebflowPlatform, platformLabel } from "@/modules/platforms/types";
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
  swatches?: string[];
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

const FLY_PACKETS = [
  { label: "pages", delay: "0s", y: "18%" },
  { label: "CMS", delay: "0.35s", y: "38%" },
  { label: "colors", delay: "0.7s", y: "28%" },
  { label: "products", delay: "1.05s", y: "52%" },
  { label: "SEO", delay: "1.4s", y: "44%" },
  { label: "FAQs", delay: "1.75s", y: "62%" },
];

function flowStatusFor(platform?: string | null) {
  if (isWebflowPlatform(platform)) {
    return [
      "Connecting to Webflow Data APIs…",
      "Reading page metadata & SEO…",
      "Loading CMS collections…",
      "Loading ecommerce catalog…",
      "Building AI context…",
    ];
  }
  if (isShopifyPlatform(platform)) {
    return [
      "Connecting to Shopify Admin…",
      "Reading pages & policies…",
      "Loading product catalog…",
      "Indexing images & variants…",
      "Building AI context…",
    ];
  }
  return [
    "Connecting to website…",
    "Extracting pages & structure…",
    "Reading products & content…",
    "Building FAQs & topics…",
    "Creating AI context…",
  ];
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

function emptyCollection(): Record<CollectionCategory, { count: number; chips: string[]; swatches?: string[] }> {
  return {
    pages: { count: 0, chips: [] },
    colors: { count: 0, chips: [], swatches: [] },
    images: { count: 0, chips: [] },
    phrases: { count: 0, chips: [] },
    intents: { count: 0, chips: [] },
    artifacts: { count: 0, chips: [] },
    topics: { count: 0, chips: [] },
    prompts: { count: 0, chips: [] },
  };
}

export function buildCollectionFromScan(
  result: ScanResult | null | undefined,
  platform?: string | null,
): Record<CollectionCategory, { count: number; chips: string[]; swatches?: string[] }> {
  if (!result) return emptyCollection();

  const u = result.understanding;
  const brand = result.brand;
  const pageChips = (result.crawl ?? [])
    .filter((item) => item.status === "crawled" && item.contentType !== "PRODUCT" && !String(item.origin).includes("store"))
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

  const phraseSource = [
    ...(brand?.phrases ?? []),
    ...(u?.faqs ?? []),
    ...(u?.differentiators ?? []),
  ];
  const phraseChips = phraseSource.map((v) => short(String(v))).filter(Boolean).slice(0, 4);

  const topicSource = [u?.industry, u?.businessType, ...(u?.offerings ?? [])].filter(
    (v): v is string => Boolean(v && String(v).trim()),
  );
  const topicChips = topicSource.map((v) => short(v)).slice(0, 4);

  const intentChips = isShopifyPlatform(platform)
    ? ["orders", "shipping", "returns", "products"].slice(0, Math.min(4, Math.max(2, result.counts.products ? 4 : 2)))
    : isWebflowPlatform(platform)
      ? ["support", "CMS", "services", "contact"].slice(0, Math.min(4, Math.max(2, (u?.faqs?.length ?? 0) > 0 ? 4 : 2)))
      : ["support", "sales", "booking", "policies"].slice(0, Math.min(4, Math.max(1, (u?.faqs?.length ?? 0) > 0 ? 3 : 1)));

  const artifactChips = [
    ...(result.counts.products ? [`${result.counts.products} products`] : []),
    ...(result.counts.faqs ? [`${result.counts.faqs} FAQs`] : []),
    ...(result.counts.policies ? [`${result.counts.policies} policies`] : []),
    ...(result.counts.chunks ? [`${result.counts.chunks} chunks`] : []),
    ...(result.counts.facts ? [`${result.counts.facts} facts`] : []),
  ].slice(0, 4);

  const promptChips = [
    u?.tone ? `${u.tone} tone` : null,
    u?.audience ? short(u.audience) : null,
    isWebflowPlatform(platform) ? "Webflow context" : isShopifyPlatform(platform) ? "store context" : "site context",
  ].filter((v): v is string => Boolean(v));

  const colorHexes = (brand?.colors ?? []).filter((c) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c));
  const colorChips =
    colorHexes.length > 0
      ? colorHexes.slice(0, 4)
      : u?.tone
        ? [toneToSwatch(u.tone), "brand accents"]
        : [];

  const imageUrls = brand?.images ?? [];
  const imageChips =
    imageUrls.length > 0
      ? [`${Math.min(imageUrls.length, 24)} media`, ...imageUrls.slice(0, 2).map((_, i) => `asset ${i + 1}`)]
      : result.counts.products > 0
        ? [`${Math.min(result.counts.products, 24)} media`]
        : [];

  const pageCount =
    result.counts.pages ||
    pageChips.length ||
    (result.crawl ?? []).filter((item) => item.status === "crawled" && item.contentType !== "PRODUCT").length;

  return {
    pages: { count: pageCount, chips: pageChips },
    colors: { count: colorHexes.length || colorChips.length, chips: colorChips, swatches: colorHexes.slice(0, 6) },
    images: { count: imageUrls.length || (imageChips.length ? Math.min(result.counts.products, 24) : 0), chips: imageChips },
    phrases: { count: phraseChips.length || (u?.faqs?.length ?? 0), chips: phraseChips },
    intents: { count: intentChips.length, chips: intentChips },
    artifacts: {
      count: (result.counts.products || 0) + (result.counts.faqs || 0) + (result.counts.policies || 0) + (result.counts.facts || 0),
      chips: artifactChips,
    },
    topics: { count: topicChips.length, chips: topicChips },
    prompts: { count: promptChips.length, chips: promptChips },
  };
}

/** Simulated fill while scan is running — unlocks categories in sequence. */
export function animatedCollection(
  tick: number,
  platform?: string | null,
): Record<CollectionCategory, { count: number; chips: string[]; filling: boolean; active: boolean; swatches?: string[] }> {
  const order = CATEGORY_META.map((c) => c.key);
  const unlocked = Math.min(order.length, Math.floor(tick / 1) + 1);
  const out = {} as Record<
    CollectionCategory,
    { count: number; chips: string[]; filling: boolean; active: boolean; swatches?: string[] }
  >;

  const pageSamples = isWebflowPlatform(platform)
    ? ["/", "/about", "/work", "/contact"]
    : isShopifyPlatform(platform)
      ? ["/", "/products", "/pages/about", "/policies"]
      : ["/", "/about", "/services", "/contact"];

  order.forEach((key, index) => {
    const filling = index === unlocked - 1;
    const done = index < unlocked - 1;
    const active = index <= unlocked - 1;
    const fakeCount = done ? Math.max(1, (index * 2 + tick) % 5) : filling ? Math.max(0, tick % 4) : 0;
    const chips =
      done || filling
        ? Array.from({ length: Math.min(3, Math.max(1, fakeCount || 1)) }, (_, i) =>
            key === "pages" ? pageSamples[i] || "…" : key === "colors" ? ["#c96442", "#1a1613", "#d9cdc4"][i] || "" : "",
          )
        : [];
    out[key] = {
      count: fakeCount,
      chips: key === "pages" || key === "colors" ? chips.filter(Boolean) : chips.map(() => ""),
      filling,
      active,
      swatches: key === "colors" && (done || filling) ? chips.filter((c) => c.startsWith("#")) : undefined,
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
  platform,
}: {
  result?: ScanResult | null;
  pending?: boolean;
  tick?: number;
  siteUrl?: string | null;
  progressLabel?: string;
  platform?: string | null;
}) {
  const t = tick ?? 0;
  const statuses = flowStatusFor(platform);
  const live = pending ? animatedCollection(t, platform) : null;
  const collected = buildCollectionFromScan(result, platform);
  const progress = pending ? Math.min(92, 12 + t * 11) : result?.ok ? 100 : 0;
  const statusText = pending
    ? statuses[Math.min(statuses.length - 1, t % statuses.length)]
    : result?.ok
      ? "AI context ready"
      : `Waiting to collect ${platformLabel(platform)} knowledge`;

  const cards: CategoryCard[] = CATEGORY_META.map((meta) => {
    if (live) {
      const row = live[meta.key];
      return {
        ...meta,
        count: row.count,
        chips: row.chips,
        swatches: row.swatches,
        active: row.active,
        filling: row.filling,
      };
    }
    const row = collected[meta.key];
    return {
      ...meta,
      count: row.count,
      chips: row.chips,
      swatches: row.swatches,
      active: row.count > 0,
      filling: false,
    };
  });

  return (
    <div className="collection-board space-y-5">
      <ScanStatusFlow
        pending={Boolean(pending)}
        done={Boolean(result?.ok)}
        siteUrl={siteUrl}
        progress={progress}
        statusText={progressLabel || statusText}
        platform={platform}
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
  const swatches = card.swatches?.filter((c) => c.startsWith("#")) ?? [];

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
      <div
        className={cn(
          "relative h-[1px] w-full bg-white/10",
          (card.active || card.filling) && "after:absolute after:inset-y-0 after:left-0 after:w-1/3 after:bg-amber-500",
        )}
      />
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
            {swatches.length
              ? swatches.slice(0, 5).map((hex) => (
                  <span
                    key={hex}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-navy-100"
                  >
                    <span className="h-3 w-3 rounded-full ring-1 ring-white/20" style={{ background: hex }} />
                    {hex}
                  </span>
                ))
              : card.chips.slice(0, 4).map((chip, i) =>
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
  platform,
}: {
  pending: boolean;
  done: boolean;
  siteUrl?: string | null;
  progress: number;
  statusText: string;
  platform?: string | null;
}) {
  let host = platformLabel(platform);
  try {
    if (siteUrl) host = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    /* keep default */
  }

  const sourceLabel = isWebflowPlatform(platform)
    ? "Webflow APIs"
    : isShopifyPlatform(platform)
      ? "Shopify Admin"
      : "Source data";

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

      <div className="relative px-4 py-7 sm:px-6">
        {/* Flight path */}
        <div className="pointer-events-none absolute inset-x-[18%] top-[46%] hidden h-0 md:block" aria-hidden>
          <svg className="h-8 w-full overflow-visible" viewBox="0 0 400 32" preserveAspectRatio="none">
            <path
              d="M0 16 C 120 16, 160 4, 200 16 S 280 28, 400 16"
              fill="none"
              stroke="rgba(201,100,66,0.35)"
              strokeWidth="1.5"
              strokeDasharray="6 8"
              className={pending ? "animate-flow-dash" : undefined}
            />
          </svg>
        </div>

        {pending ? (
          <div className="pointer-events-none absolute inset-x-[16%] top-[28%] bottom-[34%] hidden md:block" aria-hidden>
            {FLY_PACKETS.map((packet) => (
              <span
                key={packet.label}
                className="data-fly absolute left-0 rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 shadow-glow"
                style={{ top: packet.y, animationDelay: packet.delay }}
              >
                {packet.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="relative grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-3">
          <div
            className={cn(
              "relative rounded-2xl border bg-navy-900/90 p-4 transition",
              pending ? "border-sky-400/30 shadow-[0_0_32px_-12px_rgba(56,189,248,0.45)]" : "border-white/10",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                <Globe2 className={cn("h-4 w-4", pending && "animate-pulse")} />
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
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">{sourceLabel}</p>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-2 md:flex-col md:py-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-900 px-2.5 py-1 text-[11px] text-navy-200">
              <Code2 className="h-3 w-3 text-amber-400" />
              {pending ? "streaming" : done ? "200 OK" : "idle"}
            </span>
            <span
              className={cn(
                "hidden h-9 w-9 items-center justify-center rounded-full border md:flex",
                pending
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-200 animate-pulse-soft"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300",
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
            </span>
          </div>

          <div
            className={cn(
              "relative rounded-2xl border bg-gradient-to-br from-amber-500/10 to-navy-900/90 p-4 transition",
              pending || done ? "border-amber-500/40 shadow-[0_0_40px_-14px_rgba(201,100,66,0.55)]" : "border-amber-500/25",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                <Bot className={cn("h-4 w-4", pending && "animate-pulse")} />
              </span>
              <span className={cn("text-amber-400/80", pending && "animate-pulse-soft")}>✦</span>
            </div>
            <p className="font-display text-lg text-white">tidyAgent</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">AI context</p>
            {pending ? (
              <p className="mt-2 text-[11px] text-amber-100/80">Receiving site intelligence…</p>
            ) : null}
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
            className={cn("h-full rounded-full bg-amber-500 transition-[width] duration-700 ease-out", pending && "shadow-glow")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
