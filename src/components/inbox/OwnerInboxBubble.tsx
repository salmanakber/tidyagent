"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { realtimeSocketUrl } from "@/modules/realtime/publish";

type Thread = {
  id: string;
  waiting: boolean;
  joined: boolean;
  remaining: number;
  customer: string;
  preview: string;
  messages: { id: string; role: string; text: string; at: string }[];
};

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const beep = (freq: number, at: number, dur = 0.12) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    };
    const now = ctx.currentTime;
    beep(660, now);
    beep(880, now + 0.12);
    beep(1180, now + 0.24);
  } catch {
    /* ignore */
  }
}

export function OwnerInboxBubble() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const known = useRef(new Set<string>());
  const primed = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<number>(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const active = useMemo(() => threads.find((row) => row.id === activeId) || null, [threads, activeId]);
  const waiting = threads.filter((row) => row.waiting).length;

  async function load() {
    const response = await fetch("/api/inbox/waiting", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { conversations?: Thread[] };
    const next = data.conversations ?? [];
    if (!primed.current) {
      next.forEach((row) => known.current.add(row.id));
      primed.current = true;
      setThreads(next);
      return;
    }
    const fresh = next.filter((row) => row.waiting && !known.current.has(row.id));
    if (fresh.length) {
      chime();
      if (!open) setOpen(true);
      if (!activeId) setActiveId(fresh[0].id);
    }
    next.forEach((row) => known.current.add(row.id));
    setThreads(next);
  }

  useEffect(() => {
    void load();
    let closed = false;
    let socket: WebSocket | null = null;
    const connect = () => {
      if (closed) return;
      socket = new WebSocket(realtimeSocketUrl({ role: "owner" }));
      socketRef.current = socket;
      socket.onopen = () => {
        const id = activeIdRef.current;
        if (id) socket?.send(JSON.stringify({ type: "watch", conversationId: id }));
      };
      socket.onmessage = (event) => {
        let data: { type?: string; conversationId?: string; payload?: Record<string, unknown> } = {};
        try {
          data = JSON.parse(String(event.data)) as typeof data;
        } catch {
          return;
        }
        if (data.type === "handoff" && data.conversationId) {
          const id = data.conversationId;
          if (!known.current.has(id)) {
            known.current.add(id);
            chime();
            setOpen(true);
            setActiveId((current) => current || id);
          }
          setThreads((current) => {
            const existing = current.find((row) => row.id === id);
            const next: Thread = {
              id,
              waiting: true,
              joined: false,
              remaining: Number(data.payload?.remaining) || 75,
              customer: String(data.payload?.customer || existing?.customer || "Visitor"),
              preview: String(data.payload?.preview || existing?.preview || ""),
              messages: existing?.messages ?? [],
            };
            return [next, ...current.filter((row) => row.id !== id)];
          });
        }
        if (data.type === "typing" && data.conversationId) {
          const typing = Boolean(data.payload?.typing);
          const who = String(data.payload?.name || "");
          if (who === "Visitor") {
            setPeerTyping(data.conversationId === activeIdRef.current ? typing : false);
          }
        }
        if (data.type === "message" && data.conversationId) {
          const message = data.payload?.message as Thread["messages"][number] | undefined;
          if (!message) return;
          setThreads((current) =>
            current.map((row) =>
              row.id === data.conversationId
                ? {
                    ...row,
                    preview: message.text,
                    messages: row.messages.some((item) => item.id === message.id) ? row.messages : [...row.messages, message],
                  }
                : row,
            ),
          );
        }
        if (data.type === "joined" && data.conversationId) {
          setThreads((current) =>
            current.map((row) => (row.id === data.conversationId ? { ...row, waiting: false, joined: true } : row)),
          );
        }
      };
      socket.onclose = () => {
        if (!closed) window.setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, []);

  useEffect(() => {
    setPeerTyping(false);
    const socket = socketRef.current;
    if (activeId && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "watch", conversationId: activeId }));
    }
  }, [activeId]);

  function emitTyping(on: boolean) {
    const socket = socketRef.current;
    if (!activeId || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "typing", conversationId: activeId, typing: on, name: "Team" }));
  }

  async function send() {
    if (!active || !draft.trim()) return;
    const text = draft.trim();
    emitTyping(false);
    window.clearTimeout(typingTimer.current);
    setDraft("");
    await fetch("/api/inbox/waiting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: active.id, text }),
    });
    await load();
  }

  return (
    <div className="pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex flex-col items-end gap-3 lg:bottom-[max(1rem,env(safe-area-inset-bottom))]">
      {open ? (
        <div className="inbox-bubble pointer-events-auto flex h-[min(72dvh,560px)] w-[min(100vw-1.5rem,380px)] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0f172a] shadow-panel">
          <div className="flex items-center justify-between bg-amber-500 px-4 py-3 text-navy-950">
            <div>
              <p className="text-sm font-semibold">{active ? active.customer : "Live inbox"}</p>
              <p className="text-[11px] opacity-80">{waiting ? `${waiting} waiting` : "Take over from here"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-black/10" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {!active ? (
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {threads.length === 0 ? (
                <p className="p-6 text-sm text-navy-300">When a visitor asks for a person, the chat opens here with a sound.</p>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveId(thread.id)}
                    className="w-full rounded-2xl bg-white/5 px-3 py-3 text-left"
                  >
                    <p className="text-sm font-medium text-white">{thread.customer}</p>
                    <p className="truncate text-xs text-navy-300">{thread.preview}</p>
                    {thread.waiting ? <p className="mt-1 text-[11px] text-amber-200">Waiting · {thread.remaining}s</p> : null}
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              <button type="button" className="px-4 py-2 text-left text-xs text-navy-400" onClick={() => setActiveId(null)}>
                All waiting chats
              </button>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                {active.messages.map((message) => (
                  <div key={message.id} className={cn("flex", message.role === "CUSTOMER" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        message.role === "CUSTOMER" ? "bg-amber-500 text-navy-950" : "inbox-reply bg-white/10 text-white",
                      )}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {peerTyping ? (
                  <div className="flex justify-end">
                    <div className="flex items-center gap-2 rounded-2xl bg-amber-500/15 px-3 py-2">
                      <span className="flex gap-1">
                        <i className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-amber-300 [animation-delay:-0.3s]" />
                        <i className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-amber-300 [animation-delay:-0.15s]" />
                        <i className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-amber-300" />
                      </span>
                      <span className="text-[11px] text-amber-200">Visitor is typing</span>
                    </div>
                  </div>
                ) : null}
              </div>
              <form
                className="flex gap-2 border-t border-white/10 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <input
                  className="field flex-1 bg-white/5"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    emitTyping(true);
                    window.clearTimeout(typingTimer.current);
                    typingTimer.current = window.setTimeout(() => emitTyping(false), 1400);
                  }}
                  placeholder={active.joined ? "Reply as you" : `Hi — this is me. I’ve got your chat now. How can I help?`}
                />
                <button type="submit" className="grid h-11 w-11 place-items-center rounded-full bg-amber-500 text-navy-950" disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full bg-amber-500 text-navy-950 shadow-panel"
        aria-label="Open live inbox"
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {waiting && !open ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {waiting}
          </span>
        ) : null}
      </button>
    </div>
  );
}

export function OwnerFace({ name }: { name: string }) {
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-xs">{initials(name)}</span>;
}
