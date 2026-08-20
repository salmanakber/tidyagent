"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Send, Volume2, VolumeX, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export type WidgetProps = {
  name: string;
  greeting: string;
  primaryColor: string;
  position?: "BOTTOM_RIGHT" | "BOTTOM_LEFT";
  avatarUrl?: string | null;
  preview?: boolean;
  template?: "CLASSIC" | "SOFT" | "BAR" | "MINIMAL";
  voiceEnabled?: boolean;
};

export function ChatWidget({
  name,
  greeting,
  primaryColor,
  position = "BOTTOM_RIGHT",
  avatarUrl,
  preview = false,
  template = "CLASSIC",
  voiceEnabled = false,
}: WidgetProps) {
  const left = position === "BOTTOM_LEFT";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [teaserOn, setTeaserOn] = useState(template !== "MINIMAL");
  const [voiceOn, setVoiceOn] = useState(voiceEnabled);
  const [agentName, setAgentName] = useState(name);
  const ctxRef = useRef<AudioContext | null>(null);
  const [messages, setMessages] = useState<{ role: "agent" | "customer" | "system"; text: string }[]>([
    { role: "agent", text: greeting },
  ]);

  const bubbleStyle = useMemo(() => ({ backgroundColor: primaryColor }), [primaryColor]);

  useEffect(() => {
    setAgentName(name);
    setMessages([{ role: "agent", text: greeting }]);
    setTyped("");
    setTeaserOn(template !== "MINIMAL");
    setVoiceOn(voiceEnabled);
    setOpen(false);
    if (template === "MINIMAL") return;
    let i = 0;
    const max = Math.min(greeting.length, 92);
    const id = window.setInterval(() => {
      i += 1;
      setTyped(greeting.slice(0, i));
      if (i >= max) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [greeting, name, template, voiceEnabled]);

  function unlock() {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!ctxRef.current) ctxRef.current = new Ctx();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
  }

  function beep(freq: number, dur: number, type: OscillatorType = "sine") {
    unlock();
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  async function send(text = input.trim()) {
    if (!text || thinking) return;
    setInput("");
    beep(1320, 0.07, "square");
    setMessages((current) => [...current, { role: "customer", text }]);
    setThinking(true);
    try {
      const response = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId, preview: true }),
      });
      const data = (await response.json()) as {
        text?: string;
        conversationId?: string;
        error?: string;
        handoff?: { from: string; to: string };
        agent?: { name: string };
      };
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.agent?.name) setAgentName(data.agent.name);
      setMessages((current) => [
        ...current,
        ...(data.handoff?.to
          ? [{ role: "system" as const, text: `${data.handoff.from} is connecting you with ${data.handoff.to}` }]
          : []),
        { role: "agent", text: data.text || data.error || "I couldn’t reply just then. Please try again." },
      ]);
      beep(880, 0.1, "triangle");
    } catch {
      setMessages((current) => [
        ...current,
        { role: "agent", text: "I couldn’t reach the team just then. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  }

  const radius = template === "SOFT" ? "rounded-[32px]" : template === "BAR" ? "rounded-t-3xl rounded-b-none" : "rounded-[24px]";

  return (
    <div className={cn("flex flex-col", preview ? "relative min-h-[520px]" : "pointer-events-none fixed inset-0")}>
      <div
        className={cn(
          "pointer-events-auto absolute bottom-3 flex w-[min(100%,380px)] flex-col gap-3 sm:bottom-4",
          left ? "left-3 items-start sm:left-4" : "right-3 items-end sm:right-4",
        )}
      >
        {open ? (
          <div className={cn("flex h-[min(70dvh,520px)] w-full flex-col overflow-hidden border border-black/10 bg-white shadow-panel sm:h-[420px]", radius)}>
            <div className="flex items-center gap-3 px-3 py-3 text-white sm:px-4" style={bubbleStyle}>
              <Avatar name={agentName} avatarUrl={avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agentName}</p>
                <p className="text-[11px] text-white/80">Usually replies instantly</p>
              </div>
              {voiceEnabled ? (
                <button
                  type="button"
                  onClick={() => setVoiceOn((value) => !value)}
                  className="rounded-full bg-white/15 p-2"
                  aria-label={voiceOn ? "Disable voice" : "Enable voice"}
                >
                  {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-white/90" aria-label="Close chat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className={cn("flex-1 space-y-3 overflow-y-auto p-4", template === "SOFT" ? "bg-[#f3efe6]" : "bg-slate-50")}>
              {messages.map((message, index) =>
                message.role === "system" ? (
                  <p key={index} className="text-center text-[11px] text-slate-500">
                    {message.text}
                  </p>
                ) : (
                  <div
                    key={index}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6",
                      message.role === "agent" ? "bg-white text-slate-800 shadow-sm" : "ml-auto text-white",
                    )}
                    style={message.role === "customer" ? bubbleStyle : undefined}
                  >
                    {message.text}
                  </div>
                ),
              )}
              {thinking ? (
                <div className="w-fit rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">Checking that for you…</div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 p-3">
              {voiceEnabled ? (
                <span className="rounded-full bg-slate-900 p-2 text-white" aria-hidden>
                  <Mic className="h-4 w-4" />
                </span>
              ) : null}
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void send();
                }}
                placeholder="Ask a question"
                className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-800 outline-none"
              />
              <button type="button" onClick={() => void send()} className="rounded-full p-2 text-white" style={bubbleStyle}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : teaserOn && template !== "MINIMAL" ? (
          <div
            className={cn(
              "relative max-w-[240px] cursor-pointer bg-white px-3.5 py-3 pr-8 text-slate-800 shadow-lg",
              left ? "rounded-[18px_18px_18px_6px]" : "rounded-[18px_18px_6px_18px]",
            )}
            onClick={() => {
              unlock();
              beep(740, 0.12);
              setOpen(true);
            }}
          >
            <button
              type="button"
              className="absolute right-2 top-1.5 text-slate-400"
              onClick={(event) => {
                event.stopPropagation();
                setTeaserOn(false);
              }}
              aria-label="Dismiss greeting"
            >
              ×
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: primaryColor }}>
              {name}
            </p>
            <p className="mt-1 min-h-[1.4em] text-sm leading-5">
              {typed}
              {typed.length < Math.min(greeting.length, 92) ? (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse align-middle" style={bubbleStyle} />
              ) : null}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            unlock();
            setOpen((value) => !value);
          }}
          className="relative flex h-14 w-14 items-center justify-center overflow-visible rounded-full text-sm font-semibold text-white shadow-lg sm:h-16 sm:w-16"
          style={bubbleStyle}
          aria-label={open ? "Close chat" : "Open chat"}
        >
          <span className="pointer-events-none absolute inset-[-7px] animate-ping rounded-full opacity-20" style={{ border: `2px solid ${primaryColor}` }} />
          <span className="relative h-14 w-14 overflow-hidden rounded-full sm:h-16 sm:w-16">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">{initials(name) || "AI"}</span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/25" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
      {initials(name)}
    </div>
  );
}
