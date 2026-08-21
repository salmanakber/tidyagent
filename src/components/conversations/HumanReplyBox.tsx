"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HumanReplyBox({ conversationId, waiting }: { conversationId: string; waiting: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="flex gap-3 border-t border-white/5 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim() || busy) return;
        setBusy(true);
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
        onChange={(event) => setText(event.target.value)}
        placeholder={waiting ? "Take over this chat…" : "Reply as you"}
      />
      <button className="btn-primary" disabled={busy || !text.trim()}>
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
