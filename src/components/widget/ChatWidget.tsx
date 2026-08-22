"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, History, Maximize2, Mic, Minimize2, Plus, Send, Square, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { AgentRichText, stripForVoice } from "@/components/widget/RichText";
import { widgetGradientCss } from "@/modules/widget/gradient";
import { realtimeSocketUrl } from "@/modules/realtime/publish";

export type WidgetProps = {
  name: string;
  greeting: string;
  primaryColor: string;
  useGradient?: boolean;
  gradientTo?: string;
  gradientAngle?: string;
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

type Person = { name: string; avatarUrl?: string | null; role?: string; voiceId?: string | null; human?: boolean };
type CatalogCard = { name: string; price?: string | null; imageUrl?: string | null; url?: string | null };
type BrowserSpeech = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0?: { transcript?: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type Line =
  | { kind: "msg"; role: "agent" | "customer"; text: string; at: string; agent?: Person; products?: CatalogCard[] }
  | { kind: "xfer"; from: Person; to: Person; done?: boolean }
  | { kind: "joined"; person: Person }
  | { kind: "wait"; person: Person; seconds: number }
  | { kind: "lead" };

export function ChatWidget({
  name,
  greeting,
  primaryColor,
  useGradient = false,
  gradientTo = "#4F8CFF",
  gradientAngle = "to-bottom-right",
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
  const [large, setLarge] = useState(false);
  const [humanTyping, setHumanTyping] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [listenCaption, setListenCaption] = useState("Listening…");
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const voiceDraftRef = useRef("");
  const listeningRef = useRef(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakGenRef = useRef(0);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const seenLive = useRef(new Set<string>());
  const liveSocket = useRef<WebSocket | null>(null);
  const liveClosed = useRef(false);
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const typingHideRef = useRef<number>(0);
  const [lines, setLines] = useState<Line[]>([{ kind: "msg", role: "agent", text: greeting, at: new Date().toISOString(), agent: { name, avatarUrl } }]);

  const brandStyle = useMemo(
    () => brandFill(primaryColor, useGradient, gradientTo, gradientAngle),
    [primaryColor, useGradient, gradientTo, gradientAngle],
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

  useEffect(() => {
    return () => {
      liveClosed.current = true;
      liveSocket.current?.close();
    };
  }, []);

  function applyLiveEvent(data: {
    type?: string;
    payload?: {
      human?: Person;
      typing?: boolean;
      name?: string;
      message?: { id: string; role: string; text: string; at: string; kind?: string | null };
    };
  }) {
    const human = data.payload?.human;
    const message = data.payload?.message;
    if (data.type === "typing") {
      const typing = Boolean((data.payload as { typing?: boolean } | undefined)?.typing);
      const who = String((data.payload as { name?: string } | undefined)?.name || "");
      if (who === "Visitor") return;
      window.clearTimeout(typingHideRef.current);
      if (typing) {
        setHumanTyping(agentRef.current.name);
        typingHideRef.current = window.setTimeout(() => setHumanTyping(null), 4000);
      } else {
        setHumanTyping(null);
      }
    }
    if (data.type === "joined" && human) {
      setHumanTyping(null);
      setAgent(human);
      setLines((current) => {
        const withoutWait = current.filter((item) => item.kind !== "wait");
        if (withoutWait.some((item) => item.kind === "joined")) return withoutWait;
        return [...withoutWait, { kind: "joined", person: human }];
      });
    }
    if (data.type === "message" && message && message.role !== "CUSTOMER" && !seenLive.current.has(message.id)) {
      setHumanTyping(null);
      seenLive.current.add(message.id);
      setLines((current) => [
        ...current.filter((item) => item.kind !== "wait"),
        { kind: "msg", role: "agent", text: message.text, at: message.at, agent: human || agent },
      ]);
    }
    if (data.type === "expired") {
      liveClosed.current = true;
      liveSocket.current?.close();
      setLines((current) =>
        current.some((item) => item.kind === "lead")
          ? current.filter((item) => item.kind !== "wait")
          : [...current.filter((item) => item.kind !== "wait"), { kind: "lead" }],
      );
    }
  }

  function watchLive(id: string) {
    liveClosed.current = false;
    liveSocket.current?.close();
    const connect = () => {
      if (liveClosed.current) return;
      const socket = new WebSocket(realtimeSocketUrl({ role: "visitor", preview: "1", conversationId: id }));
      liveSocket.current = socket;
      socket.onmessage = (event) => {
        try {
          applyLiveEvent(JSON.parse(String(event.data)) as Parameters<typeof applyLiveEvent>[0]);
        } catch {
          /* ignore */
        }
      };
      socket.onclose = () => {
        if (!liveClosed.current) window.setTimeout(connect, 1500);
      };
    };
    connect();
  }

  function resetChat() {
    liveClosed.current = true;
    liveSocket.current?.close();
    setConversationId(null);
    setInboxOpen(false);
    setHumanTyping(null);
    setThinking(false);
    setAgent({ name, avatarUrl, role: "Online", voiceId });
    setLines([{ kind: "msg", role: "agent", text: greeting, at: new Date().toISOString(), agent: { name, avatarUrl } }]);
  }

  function finishListen(sendIt: boolean) {
    listeningRef.current = false;
    setListening(false);
    setListenCaption("Listening…");
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    const text = (voiceDraftRef.current || input).replace(/\s+/g, " ").trim();
    voiceDraftRef.current = "";
    if (sendIt && text) void send(text);
  }

  function startListen() {
    const Rec = (window as typeof window & { SpeechRecognition?: new () => BrowserSpeech; webkitSpeechRecognition?: new () => BrowserSpeech }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => BrowserSpeech }).webkitSpeechRecognition;
    if (!Rec) return;
    stopSpeech();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    voiceDraftRef.current = "";
    const recognition = new Rec();
    recognition.lang = String(voiceId || "en-US").match(/^[a-z]{2}-[A-Z]{2}/)?.[0] || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      let finalBit = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalBit += `${piece} `;
        else interim += piece;
      }
      if (finalBit) voiceDraftRef.current = `${voiceDraftRef.current} ${finalBit}`.replace(/\s+/g, " ").trim();
      const shown = `${voiceDraftRef.current} ${interim}`.replace(/\s+/g, " ").trim();
      setListenCaption(shown || "Listening…");
      if (shown) setInput(shown);
    };
    recognition.onerror = () => finishListen(Boolean(voiceDraftRef.current));
    recognition.onend = () => {
      if (listeningRef.current) finishListen(Boolean(voiceDraftRef.current || input.trim()));
    };
    try {
      recognition.start();
    } catch {
      return;
    }
    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    setListenCaption("Listening…");
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
        products?: CatalogCard[];
        leadForm?: boolean;
        live?: boolean;
        wait?: { seconds: number; expired?: boolean; human?: Person };
        handoff?: { from: Person; to: Person };
      };
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.wait && !data.wait.expired) {
        const to = data.wait.human || data.handoff?.to || agent;
        const from = data.handoff?.from || agent;
        setLines((current) => [...current, { kind: "xfer", from, to }]);
        await new Promise((resolve) => window.setTimeout(resolve, 1800));
        setAgent(to);
        setLines((current) => [
          ...current.filter((item) => item.kind !== "xfer"),
          { kind: "wait", person: to, seconds: data.wait?.seconds || 75 },
        ]);
        if (data.conversationId) watchLive(data.conversationId);
      } else if (data.handoff?.to) {
        const from = data.handoff.from || agent;
        const to = data.handoff.to;
        setLines((current) => [...current, { kind: "xfer", from, to }]);
        await new Promise((resolve) => window.setTimeout(resolve, 2200));
        setAgent(to);
        setLines((current) => [
          ...current.filter((item) => item.kind !== "xfer"),
          { kind: "joined", person: to },
          ...(data.text
            ? [{ kind: "msg" as const, role: "agent" as const, text: data.text, at: data.createdAt || new Date().toISOString(), agent: to, products: data.products }]
            : []),
        ]);
        if (data.leadForm) {
          setLines((current) => (current.some((item) => item.kind === "lead") ? current : [...current, { kind: "lead" }]));
        }
        if (data.text) void speak(data.text, to.voiceId);
      } else if (data.live && !data.text) {
        /* visitor message stored for the human */
      } else {
        if (data.agent?.name) setAgent(data.agent);
        const reply = data.text || data.error || "I couldn’t reply just then.";
        setLines((current) => [
          ...current,
          {
            kind: "msg",
            role: "agent",
            text: reply,
            at: data.createdAt || new Date().toISOString(),
            agent: data.agent || agent,
            products: data.products,
          },
        ]);
        if (data.leadForm) {
          setLines((current) => (current.some((item) => item.kind === "lead") ? current : [...current, { kind: "lead" }]));
        }
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
    MINIMAL: "rounded-[16px] bg-[#101826] text-[#e8edf5]",
  }[template];
  const head = {
    CLASSIC: "",
    SOFT: "bg-[#2c241c]",
    BAR: "bg-[#075e54]",
    MINIMAL: "bg-[#101826]",
  }[template];
  const thread = {
    CLASSIC: "bg-[#f4f7fb]",
    SOFT: "bg-[#efe6d6]",
    BAR: "bg-[#ece5dd]",
    MINIMAL: "bg-[#0b1220]",
  }[template];

  return (
    <div className={cn("widget-isolate flex touch-manipulation flex-col", preview ? "relative min-h-[min(72dvh,580px)]" : "pointer-events-none fixed inset-0")}>
      <div
        className={cn(
          "pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex max-w-[calc(100vw-2.5rem)] flex-col gap-2",
          large ? "w-[min(100%,520px)]" : "w-[min(100%,372px)]",
          left ? "left-[max(1.25rem,env(safe-area-inset-left))] items-start" : "right-[max(1.25rem,env(safe-area-inset-right))] items-end",
        )}
      >
        {open ? (
          <div
            className={cn(
              "relative flex w-full min-h-[320px] flex-col overflow-hidden border border-black/10 shadow-panel",
              large ? "h-[min(82dvh,720px)] max-h-[calc(100dvh-6rem)]" : "h-[min(68dvh,520px)] max-h-[calc(100dvh-6rem)]",
              shell,
            )}
          >
            <div className={cn("flex shrink-0 items-center gap-1 px-2 py-2 sm:gap-1.5 sm:px-3 sm:py-2", head)} style={headerStyle}>
              <button type="button" className="shrink-0 rounded-xl bg-white/10 p-1.5" onClick={() => setInboxOpen((value) => !value)} aria-label="History">
                <History className="h-3.5 w-3.5" />
              </button>
              <Face name={agent.name} url={agent.avatarUrl} small />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{agent.name}</p>
                <p className="text-[10px] opacity-80">{humanTyping ? `${humanTyping} is typing` : agent.role || "Online"}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl bg-white/10 p-1.5"
                onClick={resetChat}
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="shrink-0 rounded-xl bg-white/10 p-1.5"
                onClick={() => setLarge((value) => !value)}
                aria-label={large ? "Smaller chat" : "Larger chat"}
                title={large ? "Smaller chat" : "Larger chat"}
              >
                {large ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
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
                    onClick={resetChat}
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
                    <p className="mt-1 text-[11px] text-slate-500">
                      {line.to.human ? "Real team member" : line.to.role || "Specialist"} · 2s
                    </p>
                    <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full w-2/3" style={brandStyle} />
                    </div>
                  </div>
                ) : line.kind === "wait" ? (
                  <WaitRing key="wait" person={line.person} seconds={line.seconds} brandStyle={brandStyle} />
                ) : line.kind === "lead" ? (
                  <LeadCapture
                    key="lead"
                    conversationId={conversationId}
                    preview={preview}
                    brandStyle={visitorStyle}
                  />
                ) : line.kind === "joined" ? (
                  <div key={index} className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    <span className="h-px flex-1 bg-slate-300" />
                    <Face name={line.person.name} url={line.person.avatarUrl} small />
                    {line.person.name} joined
                    <span className="h-px flex-1 bg-slate-300" />
                  </div>
                ) : (
                  <div key={index} className={cn("flex max-w-[min(92%,22rem)] gap-2", line.role === "customer" ? "ml-auto flex-row-reverse" : "")}>
                    {line.role === "agent" ? <Face name={line.agent?.name || agent.name} url={line.agent?.avatarUrl || agent.avatarUrl} small /> : null}
                    <div className={cn("min-w-0 space-y-1", line.role === "customer" ? "items-end text-right" : "")}>
                      {line.role === "agent" ? <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{line.agent?.name || agent.name}</p> : null}
                      <div
                        className={cn(
                          "break-words rounded-2xl px-3 py-1.5 text-[12px] leading-5",
                          line.role === "agent" ? "rounded-tl-md bg-white shadow-sm" : "rounded-tr-md",
                          template === "MINIMAL" && line.role === "agent" ? "bg-[#1a2436]" : "",
                        )}
                        style={line.role === "customer" ? visitorStyle : { color: replyColor }}
                      >
                        {line.role === "agent" ? <AgentRichText text={line.text} /> : line.text}
                      </div>
                      <p className="px-1 text-[10px] text-slate-400">{formatTime(line.at)}</p>
                      {line.role === "agent" && line.products?.length ? <ProductCards cards={line.products} /> : null}
                    </div>
                  </div>
                ),
              )}
              {thinking ? <TypingDots label="Checking that for you" /> : null}
              {humanTyping ? <TypingDots label={`${humanTyping} is typing`} /> : null}
            </div>
            <div className={cn("flex shrink-0 items-center gap-2 border-t p-2.5 sm:p-3", template === "MINIMAL" ? "border-white/10" : "border-slate-100")}>
              {listening ? (
                <>
                  <button type="button" onClick={() => finishListen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-700" aria-label="Cancel recording">
                    <X className="h-4 w-4" />
                  </button>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={visitorStyle}>
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                  </span>
                  <span className="flex h-7 items-end gap-0.5">
                    {[0, 1, 2, 3, 4].map((beat) => (
                      <span
                        key={beat}
                        className="w-0.5 animate-pulse rounded-full bg-current"
                        style={{ height: `${8 + ((beat * 7) % 16)}px`, color: primaryColor, animationDelay: `${beat * 80}ms` }}
                      />
                    ))}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[12px] text-slate-500">{listenCaption}</p>
                  <button type="button" onClick={() => finishListen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={visitorStyle} aria-label="Send recording">
                    <Send className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  {voiceEnabled ? (
                    <button
                      type="button"
                      onClick={startListen}
                      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white shadow-sm sm:h-10 sm:w-10"
                      aria-label="Start voice message"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
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
                      template === "MINIMAL" ? "bg-[#1a2436] text-[#e8edf5]" : "bg-slate-100 text-slate-800",
                    )}
                  />
                  <button type="button" onClick={() => void send()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-10 sm:w-10" style={visitorStyle}>
                    <Send className="h-4 w-4" />
                  </button>
                </>
              )}
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

function brandFill(primary: string, useGradient: boolean, gradientTo: string, angle: string) {
  if (useGradient && gradientTo) {
    return {
      backgroundImage: widgetGradientCss(primary, gradientTo, angle),
      backgroundColor: primary,
    };
  }
  return { backgroundColor: primary };
}

function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex max-w-[min(92%,18rem)] items-end gap-2">
      <div className="rounded-2xl rounded-tl-md bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
          </span>
          <span className="text-[11px] font-medium text-slate-500">{label}</span>
        </div>
      </div>
    </div>
  );
}

function WaitRing({
  person,
  seconds,
  brandStyle,
}: {
  person: Person;
  seconds: number;
  brandStyle: React.CSSProperties;
}) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next <= 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [seconds]);
  const pct = Math.max(0, Math.min(100, (left / Math.max(seconds, 1)) * 100));
  return (
    <div className="mx-auto w-[min(280px,100%)] rounded-3xl bg-white px-4 py-5 text-center shadow-sm">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(${(brandStyle as { backgroundColor?: string }).backgroundColor || "#F59E0B"} ${pct}%, #e2e8f0 0)` }}>
        <div className="grid h-[4.6rem] w-[4.6rem] place-items-center rounded-full bg-white text-xl font-semibold text-slate-800">{left}s</div>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-800">Finding {person.name}</p>
      <p className="mt-1 text-xs text-slate-500">A real teammate is being notified. Stay here — they’ll join this chat.</p>
    </div>
  );
}

function LeadCapture({
  conversationId,
  preview,
  brandStyle,
}: {
  conversationId: string | null;
  preview: boolean;
  brandStyle: React.CSSProperties;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <div className="rounded-2xl bg-white p-3 text-sm text-slate-700 shadow-sm">
        Thanks. The team has your details and will follow up.
      </div>
    );
  }

  return (
    <form
      className="space-y-2 rounded-2xl bg-white p-3 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!conversationId || busy) return;
        setBusy(true);
        try {
          const response = await fetch("/api/widget/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, name, email, phone, note, preview }),
          });
          if (response.ok) setSent(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Leave your details</p>
      <input className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
      <input className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <input className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm" placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
      <textarea className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm" placeholder="What do you need?" value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
      <button type="submit" className="w-full rounded-full py-2 text-sm font-semibold" style={brandStyle} disabled={busy}>
        {busy ? "Sending…" : "Send to the team"}
      </button>
    </form>
  );
}

function Face({ name, url, small }: { name: string; url?: string | null; small?: boolean }) {
  const size = small ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  if (url) return <img src={url} alt="" className={cn(size, "rounded-full object-cover bg-transparent")} />;
  return <span className={cn(size, "flex items-center justify-center rounded-full bg-black/20 font-semibold")}>{initials(name)}</span>;
}

function ProductCards({ cards }: { cards: CatalogCard[] }) {
  return (
    <div className="grid max-w-[min(92%,22rem)] grid-cols-1 gap-2 pt-1">
      {cards.slice(0, 4).map((card) => {
        const inner = (
          <>
            {card.imageUrl ? (
              <img src={card.imageUrl} alt="" className="h-28 w-full object-cover" />
            ) : (
              <div className="flex items-center gap-3 bg-gradient-to-br from-slate-50 to-slate-100 px-3 py-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-sm font-semibold text-slate-700 shadow-sm">
                  {(card.name.trim()[0] || "•").toUpperCase()}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">From the site</span>
              </div>
            )}
            <div className="space-y-0.5 p-2.5">
              <p className="text-[13px] font-semibold leading-5 text-slate-900">{card.name}</p>
              {card.price ? <p className="text-sm font-medium text-slate-700">{card.price}</p> : null}
            </div>
          </>
        );
        return card.url ? (
          <a
            key={`${card.name}-${card.url}`}
            href={card.url}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5"
          >
            {inner}
          </a>
        ) : (
          <div key={card.name} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
}
