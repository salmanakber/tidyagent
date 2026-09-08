"use client";

import { useState } from "react";

/**
 * Fetches Shopify's charge confirmation URL while still inside the embedded iframe
 * (where the app session cookie works), then navigates the top Admin frame to that URL.
 * Do not navigate top to /api/billing/shopify/checkout — that drops the partitioned session
 * and lands on the marketing homepage.
 */
export function ShopifyPlanCheckoutButton({
  planParam,
  label,
  className,
}: {
  planParam: string;
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/billing/shopify/checkout?plan=${encodeURIComponent(planParam)}&format=json`,
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { confirmationUrl?: string; error?: string }
        | null;
      if (!response.ok || !payload?.confirmationUrl) {
        throw new Error(payload?.error || "Could not start Shopify billing. Try again.");
      }
      // Must open Shopify Admin confirm URL in the top frame (not our app origin).
      window.open(payload.confirmationUrl, "_top");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Shopify billing.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      <button type="button" disabled={busy} onClick={() => void startCheckout()} className={className}>
        {busy ? "Opening Shopify…" : label}
      </button>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
