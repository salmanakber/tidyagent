import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
  href = "/dashboard",
}: {
  compact?: boolean;
  className?: string;
  href?: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link href={href} className={cn("flex items-center", className)} aria-label="tidyAgent">
      {compact ? (
        <img
          src="/images/logo-icon.png"
          alt="tidyAgent"
          className="h-9 w-9 rounded-xl object-cover"
        />
      ) : (
        <img
          src="/images/logo.png"
          alt="tidyAgent"
          className="h-10 w-auto max-w-[200px] object-contain object-left"
        />
      )}
    </Link>
  );
}
