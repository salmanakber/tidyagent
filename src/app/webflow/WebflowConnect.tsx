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
      url.searchParams.set("popup", "1");
      href = `${url.pathname}${url.search}`;
    } catch {
      href = installHref.includes("?") ? `${installHref}&popup=1` : `${installHref}?popup=1`;
    }

    // Sized popup — never navigate this Designer iframe (that logs you out of Webflow).
    const width = 560;
    const height = 720;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},noopener=yes`;
    const opened = window.open(href, "tidyagent_webflow_oauth", features);
    if (!opened) {
      setBlocked(true);
      return;
    }
    opened.focus();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Webflow</p>
        <h1 className="mt-3 font-display text-2xl text-white">Open your AI employee</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          Webflow cannot show the login screen inside this Launch panel. A small popup will open so you can
          approve access — keep the Designer open; do not continue inside this panel.
        </p>
        <button type="button" onClick={connect} className="btn-primary mt-6 w-full">
          Continue in a popup
        </button>
        {blocked ? (
          <p className="mt-4 text-sm leading-6 text-rose-200">
            Popup was blocked. Allow popups for agent.tidyflowapp.com, then try again. Do not open the link
            inside this panel — that can sign you out of the Webflow Designer.
          </p>
        ) : (
          <p className="mt-4 text-xs leading-5 text-navy-400">
            After you approve, the popup says you are connected. Close it and reopen tidyAgent from Launch if
            needed.
          </p>
        )}
      </div>
    </div>
  );
}
