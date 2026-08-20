"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  Wand2,
  X,
  Scale,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/agent", label: "AI Agent", icon: Bot },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/automations", label: "Automations", icon: Wand2 },
  { href: "/rules", label: "Business Rules", icon: Scale },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

const MOBILE_PRIMARY = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/conversations", label: "Inbox", icon: MessageSquare },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/knowledge", label: "Know", icon: BookOpen },
];

export function AppShell({
  children,
  orgName,
  siteName,
  userName,
  agentStatus,
  impersonating,
  suspended,
  suspendedReason,
  locked,
}: {
  children: React.ReactNode;
  orgName: string;
  siteName: string;
  userName?: string;
  agentStatus?: string;
  impersonating?: string | null;
  suspended?: boolean;
  suspendedReason?: string | null;
  locked?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = locked ? NAV.filter((item) => item.href === "/billing") : NAV;
  const mobile = locked ? [{ href: "/billing", label: "Plan", icon: CreditCard }] : MOBILE_PRIMARY;

  return (
    <div className="min-h-dvh bg-brand-gradient bg-noise">
      <div className="flex min-h-dvh">
        <aside className="hidden w-72 shrink-0 border-r border-white/5 lg:flex lg:flex-col">
          <div className="px-5 py-6">
            <Logo />
            <p className="mt-4 truncate text-xs text-navy-300">{siteName}</p>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-amber-500/15 text-amber-200"
                      : "text-navy-200 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4">
            <div className="panel flex items-center gap-3 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-navy text-xs font-semibold">
                {initials(userName || orgName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{userName || orgName}</p>
                <p className="truncate text-xs text-navy-300">{agentStatus === "ACTIVE" ? "AI employee live" : "Setup in progress"}</p>
              </div>
            </div>
          </div>
        </aside>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-navy-950/70" onClick={() => setOpen(false)} aria-label="Close menu" />
            <div className="absolute inset-y-0 left-0 w-[84%] max-w-sm bg-navy-900 p-4 shadow-panel">
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/5">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {NAV.filter((item) => !locked || item.href === "/billing").map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-navy-100 hover:bg-white/5"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
              <form action={logout} className="mt-6">
                <button className="btn-secondary w-full">Disconnect</button>
              </form>
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {impersonating ? (
            <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-navy-950">
              Viewing as site owner · signed in as platform admin {impersonating}
            </div>
          ) : null}
          {locked ? (
            <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-navy-950">
              Choose a plan to unlock the dashboard and the live chat bubble.
            </div>
          ) : null}
          {suspended ? (
            <div className="bg-rose-600 px-4 py-2 text-center text-sm text-white">
              This website’s AI employee is suspended
              {suspendedReason ? ` — ${suspendedReason}` : ""}.
            </div>
          ) : null}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-navy-950/70 px-4 py-3 backdrop-blur-xl lg:px-8">
            <button className="rounded-full p-2 hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm text-navy-300 lg:flex">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Wix-connected workspace
            </div>
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <form action={logout} className="hidden lg:block">
                <button className="btn-secondary px-3 py-1.5 text-xs">Disconnect</button>
              </form>
            </div>
          </header>
          <main className="flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-10">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-950/90 px-2 py-2 backdrop-blur-xl lg:hidden">
        <div className={cn("grid", locked ? "grid-cols-1" : "grid-cols-5")}>
          {mobile.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px]",
                  active ? "text-amber-300" : "text-navy-300",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          {locked ? null : (
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2 text-[11px] text-navy-300">
            <Menu className="h-5 w-5" />
            More
          </button>
          )}
        </div>
      </nav>
    </div>
  );
}
