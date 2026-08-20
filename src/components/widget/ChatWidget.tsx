"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, History, Mic, Send, Square, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { AgentRichText, stripForVoice } from "@/components/widget/RichText";

export type WidgetProps = {
  name: string;
  greeting: string;
  primaryColor: string;
  useGradient?: boolean;
  gradientTo?: string;
  textColor?: string;
  messageColor?: string;
  position?: "BOTTOM_RIGHT" | "BOTTOM_LEFT";
  avatarUrl?: string | null;
  preview?: boolean;
  startOpen?: boolean;
  template?: "CLASSIC" | "SOFT" | "BAR" | "MINIMAL";
  voiceEnabled?: boolean;
  voiceId?: string | null;
};

type Person = { name: string; avatarUrl?: string | null; role?: string; voiceId?: string | null };
type Line =
  | { kind: "msg"; role: "agent" | "customer"; text: string; at: string; agent?: Person }
  | { kind: "xfer"; from: Person; to: Person; done?: boolean }
  | { kind: "joined"; person: Person };

export function ChatWidget({
  name,
  greeting,
  primaryColor,
  useGradient = false,
  gradientTo = "#4F8CFF",
  textColor = "#FFFFFF",
  messageColor = "#1E293B",
  position = "BOTTOM_RIGHT",
  avatarUrl,
  preview = false,
  startOpen = false,
  template = "CLASSIC",
  voiceEnabled = false,
  voiceId,
}: WidgetProps) {
  const left = position === "BOTTOM_LEFT";
  const [open, setOpen] = useState(Boolean(startOpen));
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [teaserOn, setTeaserOn] = useState(template !== "MINIMAL");
  const [voiceOn, setVoiceOn] = useState(voiceEnabled);
  const [speaking, setSpeaking] = useState(false);
  const [agent, setAgent] = useState<Person>({ name, avatarUrl, role: "Online", voiceId });
  const [inboxOpen, setInboxOpen] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakGenRef = useRef(0);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const [lines, setLines] = useState<Line[]>([{ kind: "msg", role: "agent", text: greeting, at: new Date().toISOString(), agent: { name, avatarUrl } }]);

  const brandStyle = useMemo(
    () => brandFill(primaryColor, useGradient, gradientTo),
    [primaryColor, useGradient, gradientTo],
  );
  const headerStyle = useMemo(
    () => ({
      ...(template === "CLASSIC" || useGradient ? brandStyle : {}),
      color: textColor,
    }),
    [brandStyle, template, useGradient, textColor],
  );
  const visitorStyle = useMemo(() => ({ ...brandStyle, color: textColor }), [brandStyle, textColor]);
  const replyColor = template === "MINIMAL" && messageColor.toUpperCase() === "#1E293B" ? "#E8EDF5" : messageColor;

  useEffect(() => {
    setAgent({ name, avatarUrl, role: "Online", voiceId });
    setLines([{ kind: "msg", role: "agent", text: greeting, at: new Date().toISOString(), agent: { name, avatarUrl } }]);
    setTyped("");
    setTeaserOn(template !== "MINIMAL");
    setVoiceOn(voiceEnabled);
    setOpen(Boolean(startOpen));
    if (template === "MINIMAL") return;
    let i = 0;
    const max = Math.min(greeting.length, 92);
    const id = window.setInterval(() => {
      i += 1;
      setTyped(greeting.slice(0, i));
      if (i >= max) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [greeting, name, template, voiceEnabled, avatarUrl, voiceId, startOpen]);

  function unlock() {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!ctxRef.current) ctxRef.current = new Ctx();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
  }

  function stopSpeech() {
    speakGenRef.current += 1;
    setSpeaking(false);
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }

  async function speak(text: string, nextVoice?: string | null) {
    const spoken = stripForVoice(text);
    if (!voiceEnabled || !voiceOn || !spoken) return;
    stopSpeech();
    const gen = speakGenRef.current;
    const controller = new AbortController();
    ttsAbortRef.current = controller;
    try {
      const response = await fetch("/api/widget/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spoken.slice(0, 600), preview: true, voiceId: nextVoice || voiceId }),
        signal: controller.signal,
      });
      if (gen !== speakGenRef.current) return;
      if (!response.ok) return;
      const blob = await response.blob();
      if (gen !== speakGenRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        if (gen === speakGenRef.current) setSpeaking(false);
      };
      setSpeaking(true);
      await audio.play();
    } catch {
      if (gen !== speakGenRef.current) return;
      setSpeaking(false);
    }
  }

  async function send(text = input.trim()) {
    if (!text || thinking) return;
    setInput("");
    unlock();
    stopSpeech();
    setLines((current) => [...current, { kind: "msg", role: "customer", text, at: new Date().toISOString() }]);
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
        createdAt?: string;
        agent?: Person;
        handoff?: { from: Person; to: Person };
      };
      if (data.conversationId) setConversationId(data.conversationId);
      const next = data.agent || agent;
      const switched = Boolean(data.handoff?.to) || (next.name && next.name !== agent.name);
      if (switched && (data.handoff?.to || next.name)) {
        const from = data.handoff?.from || agent;
        const to = data.handoff?.to || next;
        setLines((current) => [...current, { kind: "xfer", from, to }]);
        await new Promise((resolve) => window.setTimeout(resolve, 2200));
        setAgent(to);
        setLines((current) => [
          ...current.filter((item) => item.kind !== "xfer"),
          { kind: "joined", person: to },
          { kind: "msg", role: "agent", text: data.text || "I’m here to help.", at: data.createdAt || new Date().toISOString(), agent: to },
        ]);
        void speak(data.text || "I’m here to help.", to.voiceId);
      } else {
        if (data.agent?.name) setAgent(data.agent);
        const reply = data.text || data.error || "I couldn’t reply just then.";
        setLines((current) => [
          ...current,
          { kind: "msg", role: "agent", text: reply, at: data.createdAt || new Date().toISOString(), agent: data.agent || agent },
        ]);
        void speak(reply, data.agent?.voiceId);
      }
    } catch {
      setLines((current) => [...current, { kind: "msg", role: "agent", text: "I couldn’t reach the team just then.", at: new Date().toISOString() }]);
    } finally {
      setThinking(false);
    }
  }

  const shell = {
    CLASSIC: "rounded-[22px] bg-white",
    SOFT: "rounded-[28px] bg-[#f7f1e6]",
    BAR: "rounded-t-[20px] rounded-b-none bg-white",
    MINIMAL: "rounded-[16px] bg-[#101826] text-white",
  }[template];
  const head = {
    CLASSIC: "text-white",
    SOFT: "bg-[#2c241c] text-white",
    BAR: "bg-[#075e54] text-white",
    MINIMAL: "bg-[#101826] text-white",
  }[template];
  const thread = {
    CLASSIC: "bg-[#f4f7fb]",
    SOFT: "bg-[#efe6d6]",
    BAR: "bg-[#ece5dd]",
    MINIMAL: "bg-[#0b1220]",
  }[template];

  return (
    <div className={cn("flex touch-manipulation flex-col", preview ? "relative min-h-[min(62dvh,480px)]" : "pointer-events-none fixed inset-0")}>
      <div
        className={cn(
          "pointer-events-auto absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] flex w-[min(100%,340px)] max-w-[calc(100vw-1rem)] flex-col gap-2",
          left ? "left-[max(0.5rem,env(safe-area-inset-left))] items-start" : "right-[max(0.5rem,env(safe-area-inset-right))] items-end",
        )}
      >
        {open ? (
          <div
            className={cn(
              "relative flex h-[min(58dvh,440px)] max-h-[calc(100dvh-5rem)] w-full min-h-[260px] flex-col overflow-hidden border border-black/10 shadow-panel",
              shell,
            )}
          >
            <div className={cn("flex shrink-0 items-center gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5", head)} style={headerStyle}>
              <button type="button" className="shrink-0 rounded-xl bg-white/10 p-1.5 sm:p-2" onClick={() => setInboxOpen((value) => !value)} aria-label="History">
                <History className="h-4 w-4" />
              </button>
              <Face name={agent.name} url={agent.avatarUrl} small />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agent.name}</p>
                <p className="text-[11px] opacity-80">{agent.role || "Online"}</p>
              </div>
              {voiceEnabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceOn((value) => {
                        const next = !value;
                        if (!next) stopSpeech();
                        return next;
                      });
                    }}
                    className={cn("shrink-0 rounded-xl p-1.5 sm:p-2", voiceOn ? "bg-white text-slate-900" : "bg-white/10")}
                    aria-label={voiceOn ? "Voice replies on" : "Voice replies off"}
                    title={voiceOn ? "Voice replies on" : "Voice replies off"}
                  >
                    <AudioLines className="h-4 w-4" />
                  </button>
                  {speaking ? (
                    <button
                      type="button"
                      onClick={stopSpeech}
                      className="shrink-0 rounded-xl bg-white p-1.5 text-rose-600 sm:p-2"
                      aria-label="Stop listening"
                      title="Stop listening"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </button>
                  ) : null}
                </>
              ) : null}
              <button type="button" onClick={() => { stopSpeech(); setOpen(false); }} className="shrink-0 rounded-xl p-1.5 sm:p-2" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {inboxOpen ? (
              <div className="absolute inset-x-0 bottom-0 top-12 z-10 bg-white p-4 text-sm text-slate-600">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Your chats</p>
                  <button
                    className="rounded-full px-3 py-1 text-xs"
                    style={visitorStyle}
                    onClick={() => {
                      setConversationId(null);
                      setInboxOpen(false);
                      setLines([{ kind: "msg", role: "agent", text: greeting, at: new Date().toISOString(), agent: { name, avatarUrl } }]);
                    }}
                  >
                    New chat
                  </button>
                </div>
                <p>Saved threads appear here on the live widget after visitors return.</p>
              </div>
            ) : null}
            <div className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4", thread)}>
              {lines.map((line, index) =>
                line.kind === "xfer" ? (
                  <div key={index} className="mx-auto w-[min(260px,100%)] rounded-2xl bg-white px-4 py-4 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-3">
                      <Face name={line.from.name} url={line.from.avatarUrl} />
                      <span className="text-xs text-slate-400">···</span>
                      <Face name={line.to.name} url={line.to.avatarUrl} />
                    </div>
                    <p className="mt-3 text-sm text-slate-800">
                      Connecting you with <span className="font-semibold">{line.to.name}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">{line.to.role || "Specialist"} · 2s</p>
                    <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full w-2/3" style={brandStyle} />
                    </div>
                  </div>
                ) : line.kind === "joined" ? (
                  <div key={index} className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    <span className="h-px flex-1 bg-slate-300" />
                    <Face name={line.person.name} url={line.person.avatarUrl} small />
                    {line.person.name} joined
                    <span className="h-px flex-1 bg-slate-300" />
                  </div>
                ) : (
                  <div key={index} className={cn("flex max-w-[min(90%,18rem)] gap-2", line.role === "customer" ? "ml-auto flex-row-reverse" : "")}>
                    {line.role === "agent" ? <Face name={line.agent?.name || agent.name} url={line.agent?.avatarUrl || agent.avatarUrl} small /> : null}
                    <div className={cn("min-w-0 space-y-1", line.role === "customer" ? "items-end text-right" : "")}>
                      {line.role === "agent" ? <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{line.agent?.name || agent.name}</p> : null}
                      <div
                        className={cn(
                          "break-words rounded-2xl px-3 py-2 text-[13px] leading-5 sm:text-sm sm:leading-6",
                          line.role === "agent" ? "rounded-tl-md bg-white shadow-sm" : "rounded-tr-md",
                          template === "MINIMAL" && line.role === "agent" ? "bg-[#1a2436]" : "",
                        )}
                        style={line.role === "customer" ? visitorStyle : { color: replyColor }}
                      >
                        {line.role === "agent" ? <AgentRichText text={line.text} /> : line.text}
                      </div>
                      <p className="px-1 text-[10px] text-slate-400">{formatTime(line.at)}</p>
                    </div>
                  </div>
                ),
              )}
              {thinking ? <p className="text-xs text-slate-400">Checking that for you…</p> : null}
            </div>
            <div className={cn("flex shrink-0 items-center gap-2 border-t p-2.5 sm:p-3", template === "MINIMAL" ? "border-white/10" : "border-slate-100")}>
              {voiceEnabled ? (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white sm:h-10 sm:w-10">
                  <Mic className="h-4 w-4" />
                </span>
              ) : null}
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void send();
                }}
                placeholder="Write a message"
                className={cn(
                  "min-w-0 flex-1 rounded-full px-3 py-2 text-base outline-none sm:px-4 sm:text-sm",
                  template === "MINIMAL" ? "bg-[#1a2436] text-white" : "bg-slate-100 text-slate-800",
                )}
              />
              <button type="button" onClick={() => void send()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10" style={visitorStyle}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : teaserOn && template !== "MINIMAL" ? (
          <button
            type="button"
            className={cn("relative flex max-w-[min(240px,calc(100vw-5.5rem))] items-start gap-2 bg-white px-3 py-3 pr-8 text-left shadow-lg", left ? "rounded-[18px_18px_18px_6px]" : "rounded-[18px_18px_6px_18px]")}
            onClick={() => setOpen(true)}
          >
            <span className="absolute right-2 top-1 text-slate-400" onClick={(event) => { event.stopPropagation(); setTeaserOn(false); }}>×</span>
            <Face name={name} url={avatarUrl} small />
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: primaryColor }}>{name}</span>
              <span className="mt-1 block text-sm text-slate-800">{typed}</span>
            </span>
          </button>
        ) : null}
        {open ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "relative flex items-center overflow-hidden rounded-full shadow-lg",
            template === "MINIMAL" ? "h-11 gap-2 bg-slate-950 pr-4" : avatarUrl ? "h-14 w-14 bg-transparent p-0" : "h-14 w-14",
          )}
          style={template === "MINIMAL" || avatarUrl ? { color: textColor } : visitorStyle}
          aria-label="Open chat"
        >
          <span className={cn("overflow-hidden rounded-full", template === "MINIMAL" ? "ml-1 h-9 w-9" : "h-full w-full")}>
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm">{initials(name)}</span>}
          </span>
          {template === "MINIMAL" ? <span className="text-sm font-semibold">Chat</span> : null}
        </button>
        )}
      </div>
    </div>
  );
}

function brandFill(primary: string, useGradient: boolean, gradientTo: string) {
  if (useGradient && gradientTo) {
    return {
      backgroundImage: `linear-gradient(135deg, ${primary} 0%, ${gradientTo} 100%)`,
      backgroundColor: primary,
    };
  }
  return { backgroundColor: primary };
}

function Face({ name, url, small }: { name: string; url?: string | null; small?: boolean }) {
  const size = small ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  if (url) return <img src={url} alt="" className={cn(size, "rounded-full object-cover bg-transparent")} />;
  return <span className={cn(size, "flex items-center justify-center rounded-full bg-black/20 font-semibold")}>{initials(name)}</span>;
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
}
