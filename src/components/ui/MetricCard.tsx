import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("panel p-5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">{value}</p>
      {hint ? <p className="mt-2 text-sm text-navy-300">{hint}</p> : null}
    </div>
  );
}
