import { recoverE164, waMeDigits } from "@/modules/support/phone";

export type SupportChannelId = "form" | "whatsapp" | "email" | "sms" | "messenger" | "instagram";

export type PublicWhatsAppChannel = {
  e164: string;
  digits: string;
};

export type PublicSupportChannels = {
  whatsapp: PublicWhatsAppChannel | null;
};

export function publicSupportChannels(whatsappRaw: string | null | undefined): PublicSupportChannels {
  const e164 = recoverE164(whatsappRaw);
  if (!e164) return { whatsapp: null };
  return { whatsapp: { e164, digits: waMeDigits(e164) } };
}
