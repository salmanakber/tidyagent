"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function WebflowConnectedPage() {
  useEffect(() => {
    try {
      window.opener?.postMessage({ type: "tidyagent-webflow-connected" }, window.location.origin);
    } catch {
      /* opener may be cross-origin or gone */
    }
    const timer = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        /* browsers may block close */
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <Logo href="/" />
        <h1 className="mt-6 font-display text-2xl text-white">Connected to Webflow</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          You can close this window and return to the Webflow Designer. Keep the Designer tab open — do not
          use the Launch panel to open Webflow login full-screen.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/dashboard" className="btn-primary">
            Open tidyAgent dashboard
          </Link>
          <button type="button" className="btn-secondary" onClick={() => window.close()}>
            Close this window
          </button>
        </div>
      </div>
    </div>
  );
}
