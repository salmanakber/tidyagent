"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
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
import { OwnerInboxBubble } from "@/components/inbox/OwnerInboxBubble";
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

const SIDEBAR_KEY = "tidyagent.sidebar.expanded";

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
  setupIncomplete,
  choosePlan,
  platformLabel = "Wix",
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
  setupIncomplete?: boolean;
  choosePlan?: boolean;
  platformLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_KEY);
      if (saved === "1") setExpanded(true);
      if (saved === "0") setExpanded(false);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const nav = locked || choosePlan
    ? NAV.filter((item) => item.href === "/billing")
    : setupIncomplete
      ? []
      : NAV;
  const mobile = locked || choosePlan
    ? [{ href: "/billing", label: "Plan", icon: CreditCard }]
    : setupIncomplete
      ? []
      : MOBILE_PRIMARY;

  return (
    <div className="min-h-dvh bg-brand-gradient bg-noise">
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            "hidden shrink-0 border-r border-white/5 transition-[width] duration-200 ease-out lg:flex lg:flex-col",
            expanded ? "w-72" : "w-[4.5rem]",
          )}
        >
          <div className={cn("flex items-start justify-between gap-2 py-5", expanded ? "px-5" : "px-3")}>
            <div className={cn("min-w-0", !expanded && "flex w-full justify-center")}>
              {expanded ? (
                <>
                  <Logo />
                  <p className="mt-4 truncate text-xs text-navy-300">{siteName}</p>
                </>
              ) : (
                <Logo compact />
              )}
            </div>
          </div>

          <nav className={cn("flex-1 space-y-1", expanded ? "px-3" : "px-2")}>
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "group relative flex items-center rounded-2xl text-sm transition",
                    expanded ? "gap-3 px-3 py-2.5" : "justify-center px-0 py-2.5",
                    active
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-navy-200 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {expanded ? <span className="truncate">{item.label}</span> : null}
                  {!expanded ? (
                    <span className="pointer-events-none absolute left-full z-40 ml-2 hidden whitespace-nowrap rounded-lg border border-white/10 bg-navy-900 px-2 py-1 text-xs text-white shadow-panel group-hover:block">
                      {item.label}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className={cn("space-y-3 pb-4", expanded ? "px-4" : "px-2")}>
            <button
              type="button"
              onClick={toggleExpanded}
              className={cn(
                "flex w-full items-center rounded-2xl border border-white/10 bg-white/[0.03] text-navy-200 transition hover:bg-white/5 hover:text-white",
                expanded ? "justify-between gap-2 px-3 py-2.5 text-sm" : "justify-center py-2.5",
              )}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <>
                  <span>Collapse</span>
                  <ChevronLeft className="h-4 w-4" />
                </>
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {expanded ? (
              <div className="panel flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-navy text-xs font-semibold">
                  {initials(userName || orgName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{userName || orgName}</p>
                  <p className="truncate text-xs text-navy-300">
                    {choosePlan
                      ? "Choose a plan to continue"
                      : setupIncomplete
                        ? "Finish setup to open the dashboard"
                        : agentStatus === "ACTIVE"
                          ? "AI employee live"
                          : "Setup in progress"}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-navy text-xs font-semibold"
                title={userName || orgName}
              >
                {initials(userName || orgName)}
              </div>
            )}
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
                {NAV.filter((item) => !(locked || choosePlan) || item.href === "/billing").map((item) => (
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
            <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
              Viewing as site owner · signed in as platform admin {impersonating}
            </div>
          ) : null}
          {locked ? (
            <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
              Choose a plan to unlock the dashboard and the live chat bubble.
            </div>
          ) : null}
          {choosePlan && !locked ? (
            <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
              Choose Free or a paid plan to continue setup.
            </div>
          ) : null}
          {setupIncomplete && !locked && !choosePlan ? (
            <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
              Finish the setup wizard to open the dashboard, inbox, and live widget.
            </div>
          ) : null}
          {suspended ? (
            <div className="bg-rose-600 px-4 py-2 text-center text-sm text-white">
              This website’s AI employee is suspended
              {suspendedReason ? ` — ${suspendedReason}` : ""}.
            </div>
          ) : null}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-navy-950/70 px-4 py-3 backdrop-blur-xl lg:px-8">
            {setupIncomplete || locked || choosePlan ? <span className="w-9 lg:hidden" /> : (
            <button className="rounded-full p-2 hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            )}
            <div className="hidden items-center gap-2 text-sm text-navy-300 lg:flex">
              <Sparkles className="h-4 w-4 text-amber-400" />
              {platformLabel}-connected workspace
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
          <main className={cn("flex-1 px-4 pt-6 lg:px-8 lg:pb-10", setupIncomplete || locked || choosePlan ? "pb-10" : "pb-28")}>{children}</main>
        </div>
      </div>
      {locked || setupIncomplete || choosePlan ? null : <OwnerInboxBubble />}

      {setupIncomplete || locked || choosePlan ? null : (
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-950/90 px-2 py-2 backdrop-blur-xl lg:hidden">
        <div className={cn("grid", locked || choosePlan ? "grid-cols-1" : "grid-cols-5")}>
          {mobile.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px]",
                  active ? "bg-amber-500/10 text-amber-300" : "text-navy-300",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          {locked || choosePlan ? null : (
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2 text-[11px] text-navy-300">
            <Menu className="h-5 w-5" />
            More
          </button>
          )}
        </div>
      </nav>
      )}
    </div>
  );
}
