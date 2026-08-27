"use client";

import { useEffect, useState } from "react";

type ShopifyGlobal = {
  ready?: Promise<void>;
  idToken: () => Promise<string>;
  config?: { apiKey?: string; host?: string; shop?: string };
};

declare global {
  interface Window {
    shopify?: ShopifyGlobal;
  }
}

/**
 * Embedded Shopify Admin auth via App Bridge session tokens.
 * App Bridge itself is injected in the root layout <head> for /shopify.
 */
export function ShopifyEmbeddedAuth({
  apiKey,
  host,
  shop,
  bootstrapIdToken = "",
}: {
  apiKey: string;
  host: string;
  shop: string;
  bootstrapIdToken?: string;
}) {
  const [status, setStatus] = useState("Opening tidyAgent…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        ensureShopifyApiKeyMeta(apiKey);

        let idToken = bootstrapIdToken.trim();
        if (!idToken) {
          const shopify = await waitForShopifyGlobal();
          if (cancelled) return;
          setStatus("Securing your store connection…");
          if (shopify.ready) await shopify.ready;
          idToken = await shopify.idToken();
        } else {
          setStatus("Securing your store connection…");
        }
        if (cancelled) return;

        setStatus("Loading your dashboard…");
        const body = await exchangeSession(idToken);
        if (cancelled) return;
        window.location.assign(body.redirect || "/");
      } catch (err) {
        if (cancelled) return;
        console.error("Shopify embedded auth failed", err);
        setError(err instanceof Error ? err.message : "Could not open tidyAgent");
        setStatus("Something went wrong");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [apiKey, host, shop, bootstrapIdToken]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Shopify</p>
        <h1 className="mt-3 font-display text-2xl text-white">{status}</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          {error
            ? error
            : "Stay on this page — your store dashboard will open automatically inside Shopify."}
        </p>
        {error ? (
          <div className="mt-6 space-y-3">
            <button type="button" className="btn-primary w-full" onClick={() => window.location.reload()}>
              Try again
            </button>
            <p className="text-xs leading-5 text-navy-500">
              Open tidyAgent from <span className="text-navy-300">Shopify Admin → Apps</span>. Make sure the Shopify
              API key in tidyAgent Admin Settings matches your Partner Dashboard client ID.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-xs text-navy-500">Connecting {shop}…</p>
        )}
      </div>
    </div>
  );
}

function ensureShopifyApiKeyMeta(apiKey: string) {
  let meta = document.querySelector('meta[name="shopify-api-key"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "shopify-api-key";
    document.head.appendChild(meta);
  }
  meta.content = apiKey;
}

async function waitForShopifyGlobal(timeoutMs = 20_000): Promise<ShopifyGlobal> {
  const started = Date.now();
  const inAdminFrame = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true; // cross-origin parent ⇒ almost certainly Admin iframe
    }
  })();

  // Head should already include App Bridge; inject only if the SSR tag is missing.
  if (!document.querySelector('script[src*="shopifycloud/app-bridge.js"]')) {
    await loadAppBridgeScript();
  }

  while (Date.now() - started < timeoutMs) {
    const shopify = window.shopify;
    if (shopify) {
      try {
        if (shopify.ready) await shopify.ready;
      } catch {
        /* ready rejected — still try idToken */
      }
      if (typeof shopify.idToken === "function") return shopify;
    }
    await sleep(40);
  }

  if (!inAdminFrame) {
    throw new Error("Shopify App Bridge did not load. Reopen tidyAgent from Apps in Shopify Admin (not a bookmark or new tab).");
  }

  const metaKey = document.querySelector('meta[name="shopify-api-key"]')?.getAttribute("content") || "";
  throw new Error(
    metaKey
      ? "Shopify App Bridge did not initialize. Confirm the Shopify API key in tidyAgent Admin Settings exactly matches your Partner Dashboard client ID, then reopen from Apps."
      : "Shopify App Bridge did not load (missing API key meta). Save your Shopify API key in tidyAgent Admin Settings, then reopen from Apps.",
  );
}

function loadAppBridgeScript() {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not download Shopify App Bridge from cdn.shopify.com"));
    document.head.appendChild(script);
  });
}

async function exchangeSession(idToken: string) {
  const response = await fetch("/api/shopify/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (response.status === 401 && response.headers.get("X-Shopify-Retry-Invalid-Session-Request") === "1") {
    const shopify = window.shopify;
    if (!shopify?.idToken) throw new Error("Could not refresh Shopify session");
    const retryToken = await shopify.idToken();
    const retry = await fetch("/api/shopify/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json",
      },
      credentials: "include",
    });
    if (!retry.ok) {
      const body = (await retry.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || "Could not connect this store");
    }
    return (await retry.json()) as { redirect?: string };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Could not connect this store");
  }
  return (await response.json()) as { redirect?: string };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
