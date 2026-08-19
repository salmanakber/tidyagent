"use client";

import { Logo } from "@/components/brand/Logo";
import { AuroraScene } from "@/components/brand/AuroraScene";

export function GoogleButton({ label }: { label: string }) {
  return (
    <a href="/api/auth/google" className="btn-secondary w-full">
      {label}
    </a>
  );
}

export function AuthShell({
  eyebrow,
  headline,
  body,
  children,
}: {
  eyebrow: string;
  headline: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <AuroraScene>
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-amber-300">{eyebrow}</p>
          <h1 className="mt-4 max-w-lg font-display text-5xl font-semibold leading-[1.08] text-white">{headline}</h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-navy-200">{body}</p>
          <div className="mt-10 h-px w-40 bg-gradient-to-r from-amber-400 to-transparent" />
        </div>
        <div className="flex justify-center lg:justify-end">{children}</div>
      </div>
    </AuroraScene>
  );
}

export function AuthCard({
  title,
  subtitle,
  action,
  submitLabel,
  extraFields,
  footer,
  error,
}: {
  title: string;
  subtitle: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  extraFields?: React.ReactNode;
  footer: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="w-full max-w-md rounded-[28px] border border-amber-400/15 bg-navy-900/55 p-8 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
      <Logo href="/" />
      <h2 className="mt-6 font-display text-3xl text-white">{title}</h2>
      <p className="mt-2 text-sm text-navy-300">{subtitle}</p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
      ) : null}
      <form action={action} className="mt-6 space-y-3">
        {extraFields}
        <input className="field" name="email" type="email" placeholder="Email" required />
        <input className="field" name="password" type="password" placeholder="Password" minLength={8} required />
        <button className="btn-primary w-full">{submitLabel}</button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-navy-400">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <GoogleButton label="Continue with Google" />
      <div className="mt-6 text-sm text-navy-300">{footer}</div>
    </div>
  );
}
