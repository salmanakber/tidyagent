/**
 * Client-safe URL helpers for the chat widget (all platforms).
 * Only http(s) product/media links and known WhatsApp hosts are allowed.
 */

export function safeHttpUrl(value?: string | null): string | null {
  try {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeWhatsAppUrl(value?: string | null): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host === "wa.me" ||
      host === "api.whatsapp.com" ||
      host === "www.whatsapp.com" ||
      host === "whatsapp.com"
    ) {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}
