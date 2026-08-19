import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
  href = "/dashboard",
  tone = "dark",
}: {
  compact?: boolean;
  className?: string;
  href?: string;
  tone?: "dark" | "light";
}) {
  const onLight = tone === "light";
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-navy shadow-glow">
        <Sparkles className="h-4 w-4 text-amber-100" />
      </span>
      {!compact && (
        <span
          className={cn(
            "font-display text-lg font-semibold tracking-tight",
            onLight ? "text-navy-900" : "text-white",
          )}
        >
          tidy<span className="text-amber-500">Agent</span>
        </span>
      )}
    </Link>
  );
}
