import { cn } from "@/lib/utils";

export function AuroraScene({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative min-h-dvh overflow-hidden bg-[#070B14] text-navy-100", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#1c1428_0%,#0B1220_42%,#070B14_100%)]" />
      <div className="pointer-events-none absolute -left-24 -top-28 h-[34rem] w-[34rem] animate-drift rounded-full bg-amber-500/35 blur-[110px]" />
      <div className="pointer-events-none absolute -right-24 top-0 h-[32rem] w-[32rem] animate-drift-alt rounded-full bg-[#6366f1]/28 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-1/4 h-[28rem] w-[28rem] rounded-full bg-amber-200/18 blur-[100px]" />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-rose-400/10 blur-[80px]" />
      <div className="pointer-events-none absolute inset-0 scene-grid" />
      <svg
        className="pointer-events-none absolute -right-28 -top-16 h-[38rem] w-[38rem] text-amber-300/25"
        viewBox="0 0 640 640"
        fill="none"
        aria-hidden
      >
        <circle cx="320" cy="320" r="140" stroke="currentColor" strokeWidth="1" />
        <circle cx="320" cy="320" r="210" stroke="currentColor" strokeWidth="1" opacity="0.7" />
        <circle cx="320" cy="320" r="280" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <path d="M320 40v80M320 520v80M40 320h80M520 320h80" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
      <svg
        className="pointer-events-none absolute -left-36 bottom-[-10rem] h-[32rem] w-[32rem] text-white/10"
        viewBox="0 0 640 640"
        fill="none"
        aria-hidden
      >
        <circle cx="320" cy="320" r="180" stroke="currentColor" strokeWidth="1" />
        <circle cx="320" cy="320" r="260" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-80" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
