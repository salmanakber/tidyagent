"use client";

import { useTransition } from "react";
import { resolveConversation } from "@/app/actions/workspace";

export function ResolveChatButton({ conversationId, open }: { conversationId: string; open: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!open) return null;
  return (
    <button
      className="btn-primary"
      disabled={pending}
      onClick={() => startTransition(async () => resolveConversation(conversationId))}
    >
      {pending ? "Saving…" : "Mark resolved"}
    </button>
  );
}
