"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { postShopifyIdToken, waitForShopifyGlobal } from "@/lib/shopify/app-bridge-client";

/**
 * Keeps App Bridge session-token telemetry alive after the initial /shopify login redirect.
 * Shopify's embedded app check looks for repeated idToken() → Authorization: Bearer calls.
 */
export function ShopifyEmbeddedSession({ apiKey }: { apiKey: string }) {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function syncSessionToken() {
      try {
        const inAdminFrame = (() => {
          try {
            return window.self !== window.top;
          } catch {
            return true;
          }
        })();
        if (!inAdminFrame) return;

        const response = await postShopifyIdToken("/api/shopify/ping", apiKey);
        if (cancelled) return;

        if (response.status === 401 && response.headers.get("X-Shopify-Retry-Invalid-Session-Request") === "1") {
          const shopify = await waitForShopifyGlobal(apiKey);
          const retryToken = await shopify.idToken();
          if (cancelled) return;
          await fetch("/api/shopify/ping", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${retryToken}`,
              Accept: "application/json",
            },
            credentials: "include",
          });
        }
      } catch {
        /* Standalone tab or App Bridge unavailable — ignore */
      }
    }

    void syncSessionToken();
    return () => {
      cancelled = true;
    };
  }, [apiKey, pathname]);

  return null;
}
