"use client";

import { useState, useTransition } from "react";
import { Palette, MessageSquareQuote, Target, MessagesSquare, Sparkles } from "lucide-react";
import { addCustomKnowledge } from "@/app/actions/workspace";
import { isShopifyPlatform, isWebflowPlatform, platformLabel } from "@/modules/platforms/types";
import { cn } from "@/lib/utils";

const KINDS = [
  {
    key: "colors",
    label: "Brand colors",
    icon: Palette,
    placeholder: "#c96442, #1a1613, warm terracotta accents",
    hint: "Hex codes or palette notes the AI should respect when describing your brand.",
  },
  {
    key: "phrases",
    label: "Key phrases",
    icon: MessageSquareQuote,
    placeholder: "Same-day delivery · Handcrafted in Brooklyn",
    hint: "Taglines, guarantees, and wording visitors should hear.",
  },
  {
    key: "intents",
    label: "Customer intents",
    icon: Target,
    placeholder: "Track order · Book a call · Compare plans",
    hint: "What people usually ask — trains routing and answers.",
  },
  {
    key: "prompts",
    label: "Reply guidance",
    icon: MessagesSquare,
    placeholder: "Be concise. Prefer product cards. Never invent prices.",
    hint: "Tone and reply rules used as priority owner instructions.",
  },
] as const;

type KindKey = (typeof KINDS)[number]["key"];

export function ManualTrainingPanel({ platform }: { platform?: string | null }) {
  const [kind, setKind] = useState<KindKey>("colors");
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const active = KINDS.find((item) => item.key === kind) ?? KINDS[0];

  const sourceLabel = isWebflowPlatform(platform)
    ? "Webflow API knowledge"
    : isShopifyPlatform(platform)
      ? "Shopify catalog knowledge"
      : "crawled site knowledge";

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-white/10 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl text-white">Manual brand training</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-navy-300">
              Teach colors, phrases, intents, and reply rules by hand. These notes sit above {sourceLabel} for your{" "}
              {platformLabel(platform)} site and are never overwritten by a scan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-[220px_1fr]">
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {KINDS.map((item) => {
            const Icon = item.icon;
            const selected = item.key === kind;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setKind(item.key);
                  setSaved(null);
                }}
                className={cn(
                  "flex min-w-[140px] items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition",
                  selected
                    ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30"
                    : "bg-white/5 text-navy-200 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const content = value.trim();
            if (content.length < 2) return;
            startTransition(async () => {
              await addCustomKnowledge(`Brand · ${active.label}`, `${active.label}:\n${content}`, {
                priority: true,
                sensitive: false,
              });
              setValue("");
              setSaved(active.label);
            });
          }}
        >
          <p className="text-xs text-navy-400">{active.hint}</p>
          <textarea
            className="field min-h-[120px] resize-y"
            placeholder={active.placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={pending || value.trim().length < 2}>
              {pending ? "Saving…" : `Save ${active.label.toLowerCase()}`}
            </button>
            {saved ? <p className="text-xs text-emerald-300">Saved {saved} as priority owner knowledge.</p> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
