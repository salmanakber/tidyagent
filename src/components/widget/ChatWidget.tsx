"use client";

import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export type WidgetProps = {
  name: string;
  greeting: string;
  primaryColor: string;
  position?: "BOTTOM_RIGHT" | "BOTTOM_LEFT";
  avatarUrl?: string | null;
  preview?: boolean;
};

export function ChatWidget({
  name,
  greeting,
  primaryColor,
  position = "BOTTOM_RIGHT",
  avatarUrl,
  preview = false,
}: WidgetProps) {
  const left = position === "BOTTOM_LEFT";
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [messages, setMessages] = useState<{ role: "agent" | "customer"; text: string }[]>([
    { role: "agent", text: greeting },
  ]);

  const bubbleStyle = useMemo(() => ({ backgroundColor: primaryColor }), [primaryColor]);

  useEffect(() => {
    setMessages([{ role: "agent", text: greeting }]);
    setTyped("");
    let i = 0;
    const max = Math.min(greeting.length, 92);
    const id = window.setInterval(() => {
      i += 1;
      setTyped(greeting.slice(0, i));
      if (i >= max) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [greeting]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setMessages((current) => [...current, { role: "customer", text }]);
    setThinking(true);
    try {
      const response = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          preview: true,
        }),
      });
      const data = (await response.json()) as { text?: string; conversationId?: string; error?: string };
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        {
          role: "agent",
          text: data.text || data.error || "I couldn’t reply just then. Please try again.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "agent", text: "I couldn’t reach the team just then. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className={cn("flex flex-col", preview ? "relative min-h-[520px]" : "pointer-events-none fixed inset-0")}>
      <div
        className={cn(
          "pointer-events-auto absolute bottom-4 flex w-[min(360px,calc(100%-1.5rem))] flex-col gap-3",
          left ? "left-4 items-start" : "right-4 items-end",
        )}
      >
        {open ? (
          <div className="flex h-[420px] w-full flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-panel animate-[widget-in_420ms_ease]">
            <div className="flex items-center gap-3 px-4 py-3 text-white" style={bubbleStyle}>
              <Avatar name={name} avatarUrl={avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="text-[11px] text-white/80">Usually replies instantly</p>
              </div>
              <button onClick={() => setOpen(false)} className="ml-auto text-white/80">
                Close
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {messages.map((message, index) => (
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
              ))}
              {thinking ? (
                <div className="w-fit rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                  Checking that for you…
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 p-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void send();
                }}
                placeholder="Ask a question"
                className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-800 outline-none"
              />
              <button onClick={() => void send()} className="rounded-full p-2 text-white" style={bubbleStyle}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "max-w-[260px] bg-white px-3.5 py-3 text-slate-800 shadow-lg",
              left ? "rounded-[18px_18px_18px_6px]" : "rounded-[18px_18px_6px_18px]",
            )}
          >
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
        )}

        <button
          onClick={() => setOpen((value) => !value)}
          className="relative flex h-16 w-16 items-center justify-center overflow-visible rounded-full text-sm font-semibold text-white shadow-lg"
          style={bubbleStyle}
          aria-label="Open chat"
        >
          <span
            className="pointer-events-none absolute inset-[-7px] animate-ping rounded-full opacity-20"
            style={{ border: `2px solid ${primaryColor}` }}
          />
          <span className="relative h-16 w-16 overflow-hidden rounded-full">
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
