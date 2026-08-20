"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CreditCard,
  Globe,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { logoutPlatformAdmin } from "@/app/actions/admin";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/sites", label: "Websites", icon: Globe },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/plans", label: "Plans", icon: SlidersHorizontal },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/access", label: "Access", icon: Shield },
];

export function AdminShell({
  children,
  email,
  role,
}: {
  children: React.ReactNode;
  email: string;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-brand-gradient bg-noise">
      <div className="flex min-h-dvh">
        <aside className="hidden w-72 shrink-0 border-r border-white/5 lg:flex lg:flex-col">
          <div className="px-5 py-6">
            <Logo href="/admin" />
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
              Platform owner
            </p>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {NAV.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                    active ? "bg-amber-500/15 text-amber-200" : "text-navy-200 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 text-xs text-navy-300">
            <p className="truncate text-white">{email}</p>
            <p className="mt-1 uppercase tracking-[0.14em]">{role}</p>
          </div>
        </aside>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-navy-950/70" onClick={() => setOpen(false)} aria-label="Close menu" />
            <div className="absolute inset-y-0 left-0 w-[84%] max-w-sm bg-navy-900 p-4">
              <div className="mb-6 flex items-center justify-between">
                <Logo href="/admin" />
                <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/5">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-navy-100"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-navy-950/70 px-4 py-3 backdrop-blur-xl lg:px-8">
            <button className="rounded-full p-2 hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <p className="hidden text-sm text-navy-300 lg:block">All connected Wix sites</p>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <form action={logoutPlatformAdmin}>
                <button className="btn-secondary px-3 py-1.5 text-xs">Sign out</button>
              </form>
            </div>
          </header>
          <main className="flex-1 px-4 pb-16 pt-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
