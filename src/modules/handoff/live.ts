export const HANDOFF_WAIT_SECONDS = 75;

export function handoffState(metadata: unknown, now = Date.now()) {
  const meta = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
  const joined = Boolean(meta.humanJoinedAt);
  const started = Date.parse(String(meta.handoffStartedAt || "")) || 0;
  const wait = Number(meta.waitSeconds) || HANDOFF_WAIT_SECONDS;
  const remaining = joined || !started ? 0 : Math.max(0, wait - Math.floor((now - started) / 1000));
  return {
    joined,
    remaining,
    expired: Boolean(!joined && started && remaining <= 0),
    startedAt: started || null,
  };
}

export function humanGreeting(name: string) {
  return `Hi — this is ${name}. I’ve got your chat now. How can I help?`;
}
