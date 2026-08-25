/** Parse Admin listed prices like "19" or "19.99" into Stripe unit_amount cents. */
export function listedAmountToCents(amount: string | null | undefined): number | null {
  if (!amount) return null;
  const trimmed = amount.trim();
  if (!trimmed || /[^\d.]/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function normalizeStripeCurrency(code: string | null | undefined) {
  const upper = (code || "USD").trim().toUpperCase() || "USD";
  return upper.toLowerCase();
}
