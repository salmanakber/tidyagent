"use client";

import { useMemo, useState } from "react";
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
  const [open, setOpen] = useState(preview);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<{ role: "agent" | "customer"; text: string }[]>([
    { role: "agent", text: greeting },
  ]);

  const bubbleStyle = useMemo(() => ({ backgroundColor: primaryColor }), [primaryColor]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((current) => [...current, { role: "customer", text }]);
    setThinking(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setMessages((current) => [
      ...current,
      {
        role: "agent",
        text: "I don’t have verified information for that yet. I can connect you with the team to confirm.",
      },
    ]);
    setThinking(false);
  }

  return (
    <div className={cn("flex flex-col", preview ? "relative min-h-[520px]" : "fixed inset-0 pointer-events-none")}>
      {open ? (
        <div
          className={cn(
            "pointer-events-auto flex h-[520px] w-full max-w-[360px] flex-col overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-panel",
            preview ? "mx-auto" : position === "BOTTOM_LEFT" ? "absolute bottom-24 left-4" : "absolute bottom-24 right-4",
          )}
        >
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
                className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6", message.role === "agent" ? "bg-white text-slate-800 shadow-sm" : "ml-auto text-white")}
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
      ) : null}

      <button
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "pointer-events-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white shadow-lg",
          preview ? "absolute bottom-4 right-4" : position === "BOTTOM_LEFT" ? "absolute bottom-4 left-4" : "absolute bottom-4 right-4",
        )}
        style={bubbleStyle}
        aria-label="Open chat"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name) || "AI"
        )}
      </button>
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
