"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { realtimeSocketUrl } from "@/modules/realtime/publish";

export function HumanReplyBox({ conversationId, waiting }: { conversationId: string; waiting: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<number>(0);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    const connect = () => {
      if (closed) return;
      socket = new WebSocket(realtimeSocketUrl({ role: "owner" }));
      socketRef.current = socket;
      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: "watch", conversationId }));
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
  }, [conversationId]);

  function emitTyping(on: boolean) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "typing", conversationId, typing: on, name: "Team" }));
  }

  return (
    <form
      className="flex gap-3 border-t border-white/5 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
        emitTyping(false);
        window.clearTimeout(typingTimer.current);
        try {
          await fetch("/api/inbox/waiting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, text: text.trim() }),
          });
          setText("");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="field flex-1"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          emitTyping(true);
          window.clearTimeout(typingTimer.current);
          typingTimer.current = window.setTimeout(() => emitTyping(false), 1400);
        }}
        placeholder={waiting ? "Take over this chat…" : "Reply as you"}
      />
      <button className="btn-primary" disabled={busy || !text.trim()}>
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
