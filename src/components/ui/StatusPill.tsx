import { cn } from "@/lib/utils";

export function StatusPill({
  status,
}: {
  status: "ACTIVE" | "DRAFT" | "PAUSED" | "connected" | "removed" | string;
}) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-400/15 text-emerald-300",
    connected: "bg-emerald-400/15 text-emerald-300",
    DRAFT: "bg-amber-400/15 text-amber-200",
    PAUSED: "bg-navy-400/20 text-navy-200",
    removed: "bg-rose-400/15 text-rose-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        map[status] ?? "bg-white/10 text-navy-200",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
