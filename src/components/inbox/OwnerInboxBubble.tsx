"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, MessageSquare, Send, X } from "lucide-react";
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

function formatTime(value?: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
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
  const scroller = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [active?.messages.length, peerTyping, activeId]);

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
    <div className="pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] right-[max(1.15rem,env(safe-area-inset-right))] z-40 flex flex-col items-end gap-3 lg:bottom-[max(1.15rem,env(safe-area-inset-bottom))]">
      {open ? (
        <div className="inbox-bubble pointer-events-auto flex h-[min(74dvh,580px)] w-[min(100vw-1.75rem,400px)] flex-col overflow-hidden">
          <div className="inbox-head">
            <div className="inbox-avatar">{initials(active?.customer || "Live")}</div>
            <div className="min-w-0 flex-1">
              <p className="inbox-title">{active ? active.customer : "Live inbox"}</p>
              <p className="inbox-sub">
                {active?.waiting ? (
                  <span className="inbox-wait-dot">Waiting · {active.remaining}s</span>
                ) : active?.joined ? (
                  <span className="inbox-live-dot">You’re in this chat</span>
                ) : waiting ? (
                  `${waiting} waiting for you`
                ) : (
                  "Visitor handoffs land here"
                )}
              </p>
            </div>
            <button type="button" className="inbox-icon" onClick={() => setOpen(false)} aria-label="Close inbox">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!active ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {threads.length === 0 ? (
                <div className="inbox-empty">
                  <span className="inbox-empty-icon">
                    <MessageSquare className="h-5 w-5" />
                  </span>
                  <p>No live chats yet</p>
                  <span>When a visitor asks for a person, it opens here with a sound so you can take over.</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  {threads.map((thread) => (
                    <li key={thread.id}>
                      <button type="button" className="inbox-row" onClick={() => setActiveId(thread.id)}>
                        <span className="inbox-avatar sm">{initials(thread.customer)}</span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="inbox-row-top">
                            <span className="inbox-row-name">{thread.customer}</span>
                            {thread.waiting ? <span className="inbox-pill wait">Waiting</span> : thread.joined ? <span className="inbox-pill live">Live</span> : null}
                          </span>
                          <span className="inbox-row-preview">{thread.preview || "New handoff"}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <button type="button" className="inbox-back" onClick={() => setActiveId(null)}>
                <ChevronLeft className="h-4 w-4" />
                All chats
              </button>
              {active.waiting && !active.joined ? (
                <p className="inbox-banner">Visitor is waiting. Send a message to join this chat.</p>
              ) : null}
              <div ref={scroller} className="inbox-thread min-h-0 flex-1 overflow-y-auto">
                {active.messages.length === 0 ? (
                  <p className="inbox-thread-empty">No messages in this thread yet.</p>
                ) : (
                  active.messages.map((message) => (
                    <div key={message.id} className={cn("inbox-line", message.role === "CUSTOMER" ? "visitor" : "agent")}>
                      <div className={cn("inbox-msg", message.role === "CUSTOMER" ? "visitor" : "agent")}>{message.text}</div>
                      {message.at ? <time>{formatTime(message.at)}</time> : null}
                    </div>
                  ))
                )}
                {peerTyping ? (
                  <div className="inbox-line visitor">
                    <div className="inbox-typing">
                      <span>
                        <i />
                        <i />
                        <i />
                      </span>
                      Visitor is typing
                    </div>
                  </div>
                ) : null}
              </div>
              <form
                className="inbox-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    emitTyping(true);
                    window.clearTimeout(typingTimer.current);
                    typingTimer.current = window.setTimeout(() => emitTyping(false), 1400);
                  }}
                  placeholder={active.joined ? "Reply as you" : "Take over this chat…"}
                />
                <button type="submit" disabled={!draft.trim()} aria-label="Send">
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
        className={cn("inbox-launch pointer-events-auto", waiting && !open ? "has-wait" : "")}
        aria-label={open ? "Close live inbox" : "Open live inbox"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {waiting && !open ? <span className="inbox-badge">{waiting}</span> : null}
      </button>
    </div>
  );
}

export function OwnerFace({ name }: { name: string }) {
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-xs">{initials(name)}</span>;
}
