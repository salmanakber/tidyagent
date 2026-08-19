"use client";

import { loginPlatformAdmin } from "@/app/actions/admin";

export function AdminLoginForm({ error }: { error?: boolean }) {
  return (
    <form action={loginPlatformAdmin} className="mt-6 space-y-3">
      {error ? (
        <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">Invalid email or password.</p>
      ) : null}
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input className="field" name="password" type="password" placeholder="Password" required />
      <button className="btn-primary w-full">Sign in</button>
    </form>
  );
}
