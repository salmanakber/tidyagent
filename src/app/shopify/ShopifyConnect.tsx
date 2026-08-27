"use client";

import { useEffect, useRef } from "react";

/**
 * Shopify Admin loads this app in an iframe. Login pages (accounts.shopify.com)
 * refuse to render inside iframes — so we must break out with target="_top".
 * Never navigate the iframe itself to OAuth.
 */
export function ShopifyConnect({ installHref }: { installHref: string }) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Auto-continue without requiring a click when the browser allows it.
    linkRef.current?.click();
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Shopify</p>
        <h1 className="mt-3 font-display text-2xl text-white">Connecting your store</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          tidyAgent is opening so you can approve access. This only takes a moment.
        </p>
        <a
          ref={linkRef}
          href={installHref}
          target="_top"
          rel="noreferrer"
          className="btn-primary mt-6 inline-flex w-full justify-center"
        >
          Continue
        </a>
        <p className="mt-3 text-xs text-navy-500">If nothing happens, tap Continue.</p>
      </div>
    </div>
  );
}
