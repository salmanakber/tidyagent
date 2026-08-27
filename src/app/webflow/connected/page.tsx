"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function WebflowConnectedPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <Logo href="/" />
        <h1 className="mt-6 font-display text-2xl text-white">Connected</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          tidyAgent is linked to your Webflow site. You can close this tab and return to the Webflow Designer.
          Reopen tidyAgent from Launch if the panel still shows Connect.
        </p>
        <div className="mt-6 grid gap-3">
          <Link href="/dashboard" className="btn-primary">
            Open dashboard
          </Link>
          <button type="button" className="btn-secondary" onClick={() => window.close()}>
            Close this tab
          </button>
        </div>
      </div>
    </div>
  );
}
