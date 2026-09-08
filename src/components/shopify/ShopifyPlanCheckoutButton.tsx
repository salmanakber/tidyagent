"use client";

import { useState } from "react";

/**
 * Fetches Shopify Billing API confirmationUrl inside the iframe, then opens it
 * in the top Admin frame — same pattern as tidySync
 * (…/RecurringApplicationCharge/confirm_recurring_application_charge?…).
 *
 * Never opens the empty App Pricing /pricing_plans page.
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
        | { confirmationUrl?: string; error?: string; code?: string }
        | null;

      if (payload?.confirmationUrl) {
        // Must be the Billing API confirm URL from appSubscriptionCreate.
        window.open(payload.confirmationUrl, "_top");
        return;
      }

      throw new Error(payload?.error || "Could not start Shopify billing. Try again.");
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
      {error ? <p className="text-xs leading-5 text-rose-300">{error}</p> : null}
    </div>
  );
}
