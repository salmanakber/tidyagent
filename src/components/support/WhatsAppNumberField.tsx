"use client";

import { useEffect, useMemo, useState } from "react";
import {
  guessDefaultCountry,
  isCountryCode,
  listWhatsAppCountries,
  normalizeToE164,
  splitStoredNumber,
  WHATSAPP_E164_EXAMPLE,
} from "@/modules/support/phone";
import { cn } from "@/lib/utils";
import type { CountryCode } from "libphonenumber-js/max";

export function WhatsAppNumberField({
  value,
  onChange,
  error,
  disabled,
}: {
  value?: string | null;
  onChange: (e164: string | null, meta: { country: string; national: string; valid: boolean; error: string | null }) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const countries = useMemo(() => listWhatsAppCountries(), []);
  const initial = splitStoredNumber(value);
  const [country, setCountry] = useState<CountryCode | "">(
    initial.country || guessDefaultCountry(),
  );
  const [national, setNational] = useState(initial.national);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const next = splitStoredNumber(value);
    if (next.country) setCountry(next.country);
    if (next.national) setNational(next.national);
  }, [value]);

  const parsed = national.trim()
    ? normalizeToE164(national, country || undefined)
    : { ok: true as const, e164: null as string | null };
  const fieldError = !national.trim()
    ? null
    : parsed.ok
      ? null
      : parsed.error;
  const shownError = error || (touched ? fieldError : null);
  const selected = countries.find((row) => row.code === country);

  function emit(nextCountry: CountryCode | "", nextNational: string) {
    const trimmed = nextNational.trim();
    if (!trimmed) {
      onChange(null, { country: nextCountry, national: nextNational, valid: true, error: null });
      return;
    }
    const pasted = normalizeToE164(trimmed);
    if (pasted.ok && (trimmed.startsWith("+") || trimmed.replace(/\D/g, "").length > 11)) {
      const split = splitStoredNumber(pasted.e164);
      if (split.country) setCountry(split.country);
      if (split.national) setNational(split.national);
      onChange(pasted.e164, { country: split.country, national: split.national, valid: true, error: null });
      return;
    }
    const result = normalizeToE164(trimmed, nextCountry || undefined);
    onChange(result.ok ? result.e164 : null, {
      country: nextCountry,
      national: nextNational,
      valid: result.ok,
      error: result.ok ? null : result.error,
    });
  }

  return (
    <div className="grid gap-2 sm:col-span-2">
      <p className="text-sm text-navy-300">WhatsApp number (optional)</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(9.5rem,13rem)_1fr]">
        <label className="sr-only" htmlFor="whatsapp-country">
          Country
        </label>
        <select
          id="whatsapp-country"
          className="field"
          value={country}
          disabled={disabled}
          onChange={(event) => {
            const next = isCountryCode(event.target.value) ? event.target.value : "";
            setCountry(next);
            setTouched(true);
            emit(next, national);
          }}
        >
          {countries.map((row) => (
            <option key={row.code} value={row.code}>
              {row.name} ({row.dial})
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="whatsapp-national">
          WhatsApp number
        </label>
        <input
          id="whatsapp-national"
          className={cn("field", shownError ? "border-rose-400/60" : "")}
          inputMode="tel"
          autoComplete="tel"
          placeholder="3001234567"
          value={national}
          disabled={disabled}
          onBlur={() => setTouched(true)}
          onChange={(event) => {
            setNational(event.target.value);
            emit(country, event.target.value);
          }}
        />
      </div>
      <p className="text-xs text-navy-400">
        {selected ? `Stored as ${selected.dial}… · example ${WHATSAPP_E164_EXAMPLE}` : `Use international format, e.g. ${WHATSAPP_E164_EXAMPLE}`}
      </p>
      {shownError ? <p className="text-xs text-rose-300">{shownError}</p> : null}
    </div>
  );
}
