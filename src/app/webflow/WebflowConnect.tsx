"use client";

export function WebflowConnect({ installHref }: { installHref: string }) {
  function connect() {
    let href = installHref;
    try {
      const url = new URL(installHref, window.location.origin);
      url.searchParams.delete("embed");
      url.searchParams.set("popup", "1");
      href = `${url.pathname}${url.search}`;
    } catch {
      href = installHref.includes("?") ? `${installHref}&popup=1` : `${installHref}?popup=1`;
    }
    const opened = window.open(href, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = href;
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Webflow</p>
        <h1 className="mt-3 font-display text-2xl text-white">Open your AI employee</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          Webflow cannot show the login screen inside this panel. Continue in a new tab, approve access,
          then return here. If the tab is blocked, allow popups and try again.
        </p>
        <button type="button" onClick={connect} className="btn-primary mt-6 w-full">
          Continue in a new tab
        </button>
      </div>
    </div>
  );
}
