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

const STATUS_STEPS = [
  "Opening tidyAgent…",
  "Securing your store connection…",
  "Loading your dashboard…",
] as const;

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
  const [status, setStatus] = useState<(typeof STATUS_STEPS)[number] | "Something went wrong">(STATUS_STEPS[0]);
  const [error, setError] = useState<string | null>(null);
  const stepIndex = Math.max(
    0,
    STATUS_STEPS.findIndex((s) => s === status),
  );

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

  const failed = Boolean(error);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-brand-gradient p-6 text-center">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="shopify-auth-orb shopify-auth-orb-a absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl" />
        <div className="shopify-auth-orb shopify-auth-orb-b absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="shopify-auth-grid absolute inset-0 opacity-[0.35]" />
      </div>

      <div className="panel shopify-auth-panel relative z-10 max-w-md p-8 sm:p-10">
        {!failed ? (
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center" aria-hidden>
            <span className="shopify-auth-ring absolute h-16 w-16 rounded-full border border-amber-300/25" />
            <span className="shopify-auth-ring shopify-auth-ring-delay absolute h-16 w-16 rounded-full border border-amber-300/40" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 ring-1 ring-amber-300/35">
              <span className="shopify-auth-mark h-5 w-5 rounded-md bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.55)]" />
            </span>
          </div>
        ) : null}

        <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Shopify</p>
        <h1 className="mt-3 font-display text-2xl text-white sm:text-[1.7rem]">{status}</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          {error
            ? error
            : "Stay on this page — your store dashboard will open automatically inside Shopify."}
        </p>

        {!failed ? (
          <div className="mx-auto mt-7 max-w-xs space-y-3" aria-hidden>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="shopify-auth-bar h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500"
                style={{ width: `${((stepIndex + 1) / STATUS_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-center gap-1.5">
              {STATUS_STEPS.map((label, index) => (
                <span
                  key={label}
                  className={`h-1.5 w-8 rounded-full transition-colors duration-500 ${
                    index <= stepIndex ? "bg-amber-400" : "bg-white/15"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-navy-500">Connecting {shop}…</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <button type="button" className="btn-primary w-full" onClick={() => window.location.reload()}>
              Try again
            </button>
            <p className="text-xs leading-5 text-navy-500">
              Open tidyAgent from <span className="text-navy-300">Shopify Admin → Apps</span>. Make sure the Shopify
              API key in tidyAgent Admin Settings matches your Partner Dashboard client ID. Guide:{" "}
              <a href="/docs/shopify" className="text-amber-300 hover:underline">
                /docs/shopify
              </a>
            </p>
          </div>
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
      return true;
    }
  })();

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
    throw new Error(
      "Shopify App Bridge did not load. Reopen tidyAgent from Apps in Shopify Admin (not a bookmark or new tab).",
    );
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
