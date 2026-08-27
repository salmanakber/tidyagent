"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
    };
  }
}

/**
 * Embedded Shopify Admin auth via App Bridge session tokens.
 * Never break out to accounts.shopify.com inside/outside the iframe — that causes
 * the "browser cookies" error and the stuck Connecting screen.
 */
export function ShopifyEmbeddedAuth({
  apiKey,
  host,
  shop,
}: {
  apiKey: string;
  host: string;
  shop: string;
}) {
  const [status, setStatus] = useState("Opening tidyAgent…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await ensureAppBridge(apiKey, host);
        if (cancelled) return;
        setStatus("Securing your store connection…");

        const idToken = await window.shopify!.idToken();
        if (cancelled) return;

        setStatus("Loading your dashboard…");
        const response = await fetch("/api/shopify/session", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            Accept: "application/json",
          },
          credentials: "include",
        });

        if (response.status === 401 && response.headers.get("X-Shopify-Retry-Invalid-Session-Request") === "1") {
          const retryToken = await window.shopify!.idToken();
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
          const retryBody = (await retry.json()) as { redirect?: string };
          window.location.assign(retryBody.redirect || "/");
          return;
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Could not connect this store");
        }

        const body = (await response.json()) as { redirect?: string };
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
  }, [apiKey, host, shop]);

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
          <button type="button" className="btn-primary mt-6 w-full" onClick={() => window.location.reload()}>
            Try again
          </button>
        ) : (
          <p className="mt-6 text-xs text-navy-500">Connecting {shop}…</p>
        )}
      </div>
    </div>
  );
}

function ensureAppBridge(apiKey: string, host: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("App Bridge only runs in the browser"));
      return;
    }

    if (!document.querySelector('meta[name="shopify-api-key"]')) {
      const meta = document.createElement("meta");
      meta.name = "shopify-api-key";
      meta.content = apiKey;
      document.head.appendChild(meta);
    } else {
      const meta = document.querySelector('meta[name="shopify-api-key"]') as HTMLMetaElement;
      meta.content = apiKey;
    }

    const existing = document.querySelector("script[data-tidyagent-app-bridge]");
    if (existing && window.shopify?.idToken) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
    script.async = true;
    script.dataset.tidyagentAppBridge = "1";
    script.dataset.apiKey = apiKey;
    if (host) script.dataset.host = host;

    const started = Date.now();
    const waitForShopify = () => {
      if (window.shopify?.idToken) {
        resolve();
        return;
      }
      if (Date.now() - started > 12_000) {
        reject(new Error("Shopify App Bridge did not load. Reopen tidyAgent from Apps in Shopify Admin."));
        return;
      }
      window.setTimeout(waitForShopify, 50);
    };

    script.onload = () => waitForShopify();
    script.onerror = () => reject(new Error("Could not load Shopify App Bridge"));
    document.head.appendChild(script);
    waitForShopify();
  });
}
