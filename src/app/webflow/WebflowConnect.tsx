"use client";

import { useState } from "react";

export function WebflowConnect({ installHref }: { installHref: string }) {
  const [blocked, setBlocked] = useState(false);

  function connect() {
    setBlocked(false);
    let href = installHref;
    try {
      const url = new URL(installHref, window.location.origin);
      url.searchParams.delete("embed");
      // Marks this as a Designer Launch open so OAuth returns to /webflow/connected.
      url.searchParams.set("popup", "1");
      href = `${url.pathname}${url.search}`;
    } catch {
      href = installHref.includes("?") ? `${installHref}&popup=1` : `${installHref}?popup=1`;
    }

    // Open a real new tab. Do not use the noopener feature flag here — browsers then
    // return null from window.open and we falsely show “blocked” while auth still runs.
    // Never assign window.location in this Launch panel — that signs you out of Designer.
    const opened = window.open(href, "_blank");
    if (opened == null) {
      setBlocked(true);
      return;
    }
    try {
      opened.opener = null;
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Webflow</p>
        <h1 className="mt-3 font-display text-2xl text-white">Connect tidyAgent</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          Approve access in a new browser tab, then return here. Keep this Webflow Designer window open.
        </p>
        <button type="button" onClick={connect} className="btn-primary mt-6 w-full">
          Continue in a new tab
        </button>
        {blocked ? (
          <p className="mt-4 text-sm leading-6 text-rose-200">
            Your browser blocked the new tab. Allow pop-ups for agent.tidyflowapp.com, then try again.
          </p>
        ) : (
          <p className="mt-4 text-xs leading-5 text-navy-400">
            After you approve, the new tab confirms the connection. Close that tab and continue in Designer.
          </p>
        )}
      </div>
    </div>
  );
}
