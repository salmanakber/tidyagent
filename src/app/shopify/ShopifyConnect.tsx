"use client";

import { useEffect, useState } from "react";

/**
 * Shopify admin embeds this app in an iframe. OAuth cannot complete inside that
 * iframe, so we escalate to the top window for authorize, then the callback
 * returns into admin.shopify.com/.../apps/... so the dashboard stays embedded.
 */
export function ShopifyConnect({ installHref }: { installHref: string }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    try {
      const target = window.top ?? window;
      target.location.assign(installHref);
    } catch {
      setBlocked(true);
      window.location.assign(installHref);
    }
  }, [installHref]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Shopify</p>
        <h1 className="mt-3 font-display text-2xl text-white">Opening tidyAgent</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          Connecting this store so the dashboard loads inside Shopify Admin.
        </p>
        {blocked ? (
          <a href={installHref} className="btn-primary mt-6 inline-flex w-full justify-center" target="_top" rel="noreferrer">
            Continue
          </a>
        ) : (
          <p className="mt-6 text-xs text-navy-400">One moment…</p>
        )}
      </div>
    </div>
  );
}
