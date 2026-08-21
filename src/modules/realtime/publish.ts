export type RealtimeEvent = {
  type: "handoff" | "message" | "joined" | "expired" | "inbox" | "ready" | "error" | "typing";
  organizationId?: string;
  conversationId?: string;
  payload?: Record<string, unknown>;
};

type Hub = {
  publish: (event: RealtimeEvent) => void;
  scheduleExpiry: (conversationId: string, seconds: number) => void;
};

function hub(): Hub | null {
  const value = (globalThis as { __tidyRealtime?: Hub }).__tidyRealtime;
  return value ?? null;
}

export function publishRealtime(event: RealtimeEvent) {
  hub()?.publish(event);
}

export function scheduleHandoffExpiry(conversationId: string, seconds: number) {
  hub()?.scheduleExpiry(conversationId, seconds);
}

export function realtimeSocketUrl(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "";
  return `${proto}//${host}/realtime?${params.toString()}`;
}
