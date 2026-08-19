"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Pause, Play, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Message =
  | { id: string; from: "customer" | "agent"; kind: "text"; text: string; badge?: string }
  | {
      id: string;
      from: "agent";
      kind: "image";
      name: string;
      price: string;
      availability: string;
      image: string;
      badge?: string;
    }
  | {
      id: string;
      from: "customer" | "agent";
      kind: "voice";
      durationLabel: string;
      durationMs: number;
      transcript?: string;
      badge?: string;
    };

const AVA =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&h=160&q=80";
const PRODUCT =
  "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=640&h=420&q=80";
const HERO =
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&h=700&q=80";

const SCRIPT: Message[] = [
  {
    id: "m1",
    from: "customer",
    kind: "text",
    text: "Do you have the eco deep-clean kit in stock?",
  },
  {
    id: "m2",
    from: "agent",
    kind: "image",
    name: "Eco Deep-Clean Kit",
    price: "$34",
    availability: "In stock · 12 left",
    image: PRODUCT,
    badge: "Live catalog",
  },
  {
    id: "m3",
    from: "customer",
    kind: "text",
    text: "Perfect. Can I also book a cleaner for Friday?",
  },
  {
    id: "m4",
    from: "agent",
    kind: "text",
    text: "Friday works — 9am and 1pm are open. Want me to hold one?",
    badge: "Booking calendar",
  },
  {
    id: "m5",
    from: "customer",
    kind: "voice",
    durationLabel: "0:06",
    durationMs: 6000,
  },
  {
    id: "m6",
    from: "agent",
    kind: "voice",
    durationLabel: "0:08",
    durationMs: 8000,
    transcript: "Booked for 9am Friday. Confirmation is in your inbox.",
    badge: "Booking confirmed",
  },
];

const CUSTOMER_BARS = [28, 52, 38, 72, 44, 60, 32, 48, 66, 40, 28, 54, 42];
const AGENT_BARS = [38, 64, 48, 78, 54, 70, 42, 58, 74, 48, 36, 62, 52, 34];

export function WidgetSimulator() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visibleCount >= SCRIPT.length) {
      const resetTimer = setTimeout(() => {
        setVisibleCount(0);
        setPlayedIds(new Set());
      }, 3800);
      return () => clearTimeout(resetTimer);
    }

    const next = SCRIPT[visibleCount];
    const isAgent = next.from === "agent";
    if (isAgent) setTyping(true);

    const timer = setTimeout(() => {
      setTyping(false);
      setVisibleCount((count) => count + 1);
    }, isAgent ? 1400 : 1100);

    return () => clearTimeout(timer);
  }, [visibleCount]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [visibleCount, typing]);

  useEffect(() => {
    const revealed = SCRIPT.slice(0, visibleCount);
    const lastAgentVoice = [...revealed].reverse().find((m) => m.kind === "voice" && m.from === "agent");
    if (lastAgentVoice && !playedIds.has(lastAgentVoice.id) && playingId !== lastAgentVoice.id) {
      setPlayingId(lastAgentVoice.id);
      const durationMs = lastAgentVoice.kind === "voice" ? lastAgentVoice.durationMs : 4000;
      const finish = setTimeout(() => {
        setPlayingId(null);
        setPlayedIds((prev) => new Set(prev).add(lastAgentVoice.id));
      }, durationMs);
      return () => clearTimeout(finish);
    }
  }, [visibleCount, playedIds, playingId]);

  const replay = () => {
    setVisibleCount(0);
    setPlayedIds(new Set());
    setPlayingId(null);
    setTyping(false);
  };

  const togglePlay = (message: Extract<Message, { kind: "voice" }>) => {
    if (playingId === message.id) {
      setPlayingId(null);
      return;
    }
    setPlayedIds((prev) => {
      const next = new Set(prev);
      next.delete(message.id);
      return next;
    });
    setPlayingId(message.id);
    setTimeout(() => {
      setPlayingId(null);
      setPlayedIds((prev) => new Set(prev).add(message.id));
    }, message.durationMs);
  };

  const visibleMessages = SCRIPT.slice(0, visibleCount);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-navy-900/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[28px] bg-navy-900 shadow-[0_32px_80px_-28px_rgba(11,18,32,0.45)] ring-1 ring-navy-900/10">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="mx-auto flex h-7 max-w-[220px] flex-1 items-center justify-center rounded-full bg-white/[0.08] px-3 text-[11px] text-navy-300">
            brightandco.com
          </div>
          <span className="w-10" />
        </div>

        <div className="relative overflow-hidden bg-[#0F1830]">
          <Storefront />

          <div className="absolute bottom-4 right-4 z-10 w-[min(100%-1.75rem,292px)] sm:bottom-5 sm:right-5">
            <div className="overflow-hidden rounded-[24px] bg-[#0B1220] shadow-[0_18px_50px_-18px_rgba(0,0,0,0.65)] ring-1 ring-amber-400/20">
              <div className="flex items-center gap-2.5 bg-amber-navy px-3.5 py-3 text-white">
                <img src={AVA} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/30" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight">Ava</p>
                  <p className="flex items-center gap-1.5 text-[10px] text-white/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    Bright &amp; Co · online
                  </p>
                </div>
                <button
                  type="button"
                  onClick={replay}
                  className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Replay conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div ref={scroller} className="h-[268px] space-y-2.5 overflow-y-auto bg-[#0B1220] p-3">
                {visibleMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex animate-fade-up flex-col",
                      message.from === "customer" ? "items-end" : "items-start",
                    )}
                  >
                    {message.kind === "text" && (
                      <div
                        className={cn(
                          "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-5",
                          message.from === "customer"
                            ? "rounded-br-md bg-amber-500 text-navy-950"
                            : "rounded-bl-md bg-white/10 text-navy-100",
                        )}
                      >
                        {message.text}
                      </div>
                    )}

                    {message.kind === "image" && (
                      <div className="w-full max-w-[88%] overflow-hidden rounded-2xl rounded-bl-md bg-white/[0.08] ring-1 ring-white/10">
                        <img src={message.image} alt="" className="h-24 w-full object-cover" />
                        <div className="px-3 py-2.5">
                          <p className="text-[13px] font-semibold text-white">{message.name}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[13px] font-medium text-amber-300">{message.price}</span>
                            <span className="text-[10px] text-navy-300">{message.availability}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {message.kind === "voice" && (
                      <VoiceBubble
                        message={message}
                        isPlaying={playingId === message.id}
                        isPlayed={playedIds.has(message.id)}
                        onToggle={message.from === "agent" ? () => togglePlay(message) : undefined}
                      />
                    )}

                    {"badge" in message && message.badge ? (
                      <span className="mt-1 flex items-center gap-1 text-[10px] text-navy-400">
                        <BadgeCheck className="h-3 w-3 text-amber-400" />
                        {message.badge}
                      </span>
                    ) : null}
                  </div>
                ))}

                {typing ? (
                  <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-white/10 px-3 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-300 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-300 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-300" />
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 border-t border-white/10 bg-[#0B1220] px-3 py-2.5">
                <div className="flex-1 rounded-full bg-white/[0.08] px-3.5 py-2 text-[12px] text-navy-400">
                  Ask Ava anything
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-navy-950">
                  <Send className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Storefront() {
  return (
    <div className="relative min-h-[500px] sm:min-h-[540px]">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-navy-950">
            B
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-white">Bright &amp; Co</span>
        </div>
        <nav className="hidden items-center gap-5 text-[11px] font-medium text-navy-300 sm:flex">
          <span>Services</span>
          <span>Shop</span>
          <span>Book</span>
        </nav>
        <span className="rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-medium text-navy-200 ring-1 ring-white/10">
          Cart · 0
        </span>
      </header>

      <div className="grid gap-5 px-5 pb-36 pt-5 sm:grid-cols-[1fr_0.9fr] sm:px-6 sm:pb-10 sm:pt-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">Housekeeping</p>
          <h3 className="mt-2 max-w-xs font-display text-[1.65rem] font-semibold leading-[1.15] text-white sm:text-[1.85rem]">
            Spring cleaning, handled.
          </h3>
          <p className="mt-3 max-w-[16rem] text-[13px] leading-6 text-navy-300">
            Eco kits, booked cleaners, and answers from someone who actually knows the catalog.
          </p>
          <div className="mt-5 hidden gap-2 sm:flex">
            <span className="rounded-full bg-amber-500 px-4 py-2 text-[12px] font-semibold text-navy-950">Book a cleaner</span>
            <span className="rounded-full bg-white/[0.08] px-4 py-2 text-[12px] font-medium text-navy-100 ring-1 ring-white/10">
              Shop kits
            </span>
          </div>
        </div>
        <div className="relative hidden overflow-hidden rounded-2xl ring-1 ring-white/10 sm:block">
          <img src={HERO} alt="" className="h-[200px] w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1830] to-transparent" />
        </div>
      </div>
    </div>
  );
}

function VoiceBubble({
  message,
  isPlaying,
  isPlayed,
  onToggle,
}: {
  message: Extract<Message, { kind: "voice" }>;
  isPlaying: boolean;
  isPlayed: boolean;
  onToggle?: () => void;
}) {
  const isAgent = message.from === "agent";
  const bars = isAgent ? AGENT_BARS : CUSTOMER_BARS;

  return (
    <div
      className={cn(
        "flex max-w-[88%] items-center gap-2 rounded-2xl px-3 py-2",
        isAgent ? "rounded-bl-md bg-white/10" : "rounded-br-md bg-amber-500",
      )}
    >
      {isAgent && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-navy-950"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex h-5 items-end gap-[2.5px]">
          {bars.map((height, index) => (
            <span
              key={index}
              className={cn("w-[2.5px] origin-bottom rounded-full", isAgent ? "bg-amber-300/80" : "bg-navy-950/70")}
              style={{
                height: `${height}%`,
                animation: isPlaying ? `wave-bar 0.9s ease-in-out ${index * 0.05}s infinite` : undefined,
              }}
            />
          ))}
        </div>
        {message.transcript && (isPlaying || isPlayed) ? (
          <p className={cn("text-[11px] leading-4", isAgent ? "text-navy-200" : "text-navy-950/80")}>{message.transcript}</p>
        ) : null}
      </div>
      <span className={cn("shrink-0 text-[10px]", isAgent ? "text-navy-400" : "text-navy-950/60")}>{message.durationLabel}</span>
    </div>
  );
}
