"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error.message, error.digest);
  }, [error]);

  return (
    <div className="panel mx-auto max-w-lg p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Dashboard</p>
      <h1 className="mt-3 font-display text-2xl text-white">This page could not load</h1>
      <p className="mt-3 text-sm leading-6 text-navy-300">
        Nothing is wrong with your live chat. Refresh and continue setup — plan limits never take down the dashboard.
      </p>
      <button type="button" className="btn-primary mt-6" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
