import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export const WHATSAPP_E164_EXAMPLE = "+92XXXXXXXXXX";

const PINNED: CountryCode[] = [
  "US",
  "GB",
  "CA",
  "AU",
  "PK",
  "IN",
  "AE",
  "SA",
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
  "BR",
  "MX",
  "NG",
  "ZA",
  "PH",
  "MY",
  "SG",
  "TR",
  "EG",
];

export type CountryOption = {
  code: CountryCode;
  dial: string;
  name: string;
};

export function isCountryCode(value?: string | null): value is CountryCode {
  if (!value) return false;
  return (getCountries() as string[]).includes(value);
}

export function normalizeToE164(
  raw: string,
  defaultCountry?: string | null,
): { ok: true; e164: string; country?: CountryCode } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a WhatsApp number." };
  }

  const country = isCountryCode(defaultCountry) ? defaultCountry : undefined;
  const parsed =
    parsePhoneNumberFromString(trimmed, country) ||
    parsePhoneNumberFromString(trimmed.startsWith("+") ? trimmed : `+${digitsOnly(trimmed)}`);

  if (!parsed?.isValid()) {
    return {
      ok: false,
      error: country
        ? "Enter a valid WhatsApp number for the selected country."
        : "Enter a valid international WhatsApp number, e.g. +92XXXXXXXXXX.",
    };
  }

  return { ok: true, e164: parsed.number, country: parsed.country };
}

export function optionalWhatsAppE164(
  raw: string | null | undefined,
  country?: string | null,
): { ok: true; e164: string | null } | { ok: false; error: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: true, e164: null };
  const result = normalizeToE164(trimmed, country);
  if (!result.ok) return result;
  return { ok: true, e164: result.e164 };
}

/** Accept already-saved values that may lack a leading + or contain spaces. */
export function recoverE164(raw: string | null | undefined): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const direct = normalizeToE164(trimmed);
  if (direct.ok) return direct.e164;
  const digits = digitsOnly(trimmed);
  if (digits.length >= 8) {
    const retry = normalizeToE164(`+${digits}`);
    if (retry.ok) return retry.e164;
  }
  return null;
}

export function waMeDigits(e164: string): string {
  return digitsOnly(e164.startsWith("+") ? e164 : `+${e164}`);
}

export function isValidWhatsAppE164(raw: string | null | undefined): boolean {
  return Boolean(recoverE164(raw));
}

export function splitStoredNumber(raw: string | null | undefined): {
  country: CountryCode | "";
  national: string;
  e164: string | null;
} {
  const recovered = recoverE164(raw);
  if (!recovered) {
    return { country: "", national: (raw || "").trim(), e164: null };
  }
  const parsed = parsePhoneNumberFromString(recovered);
  return {
    country: parsed?.country || "",
    national: parsed?.formatNational().replace(/[^\d]/g, "") || parsed?.nationalNumber || recovered,
    e164: recovered,
  };
}

export function listWhatsAppCountries(locale = "en"): CountryOption[] {
  const names =
    typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames([locale], { type: "region" })
      : null;
  const all = getCountries().map((code) => ({
    code,
    dial: `+${getCountryCallingCode(code)}`,
    name: names?.of(code) || code,
  }));
  const pinned = PINNED.map((code) => all.find((row) => row.code === code)).filter(
    (row): row is CountryOption => Boolean(row),
  );
  const rest = all
    .filter((row) => !PINNED.includes(row.code))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
}

export function guessDefaultCountry(): CountryCode {
  if (typeof navigator === "undefined") return "US";
  const region = navigator.language?.split("-")[1]?.toUpperCase();
  if (isCountryCode(region)) return region;
  return "US";
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}
