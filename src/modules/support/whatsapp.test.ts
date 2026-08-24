import { describe, expect, it } from "vitest";
import { normalizeToE164, optionalWhatsAppE164, recoverE164, waMeDigits } from "@/modules/support/phone";
import { buildWhatsAppHandoffText, buildWhatsAppUrl, condensedVisitorSummary } from "@/modules/support/whatsapp";
import { publicSupportChannels } from "@/modules/support/channels";

describe("WhatsApp phone normalization", () => {
  it("stores a Pakistan mobile in E.164", () => {
    const result = normalizeToE164("03001234567", "PK");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.e164).toBe("+923001234567");
      expect(waMeDigits(result.e164)).toBe("923001234567");
    }
  });

  it("accepts an already-international number", () => {
    const result = normalizeToE164("+447911123456");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164.startsWith("+44")).toBe(true);
  });

  it("rejects obviously invalid numbers", () => {
    expect(normalizeToE164("12", "US").ok).toBe(false);
    expect(normalizeToE164("not-a-number", "PK").ok).toBe(false);
  });

  it("treats empty as optional", () => {
    expect(optionalWhatsAppE164("  ")).toEqual({ ok: true, e164: null });
  });

  it("recovers existing numbers without a plus", () => {
    expect(recoverE164("923001234567")).toBe("+923001234567");
    expect(recoverE164("+92 300 1234567")).toBe("+923001234567");
  });

  it("hides invalid saved numbers from the public widget", () => {
    expect(publicSupportChannels("123").whatsapp).toBeNull();
    expect(publicSupportChannels("+923001234567").whatsapp?.digits).toBe("923001234567");
  });
});

describe("WhatsApp handoff message", () => {
  it("builds a concise prefilled message without dumping the thread", () => {
    const text = buildWhatsAppHandoffText({
      question: "Do you have a 2-hour jet ski on Saturday?",
      summary: "Visitor asked about jet ski availability this weekend.",
      conversationId: "clxyz123",
    });
    expect(text).toContain("need help from a team member");
    expect(text).toContain("My question:");
    expect(text).toContain("2-hour jet ski");
    expect(text).toContain("#clxyz123");
    expect(text).not.toMatch(/AGENT:/);
  });

  it("builds a wa.me URL with encoded text", () => {
    const url = buildWhatsAppUrl("+923001234567", "Hello there");
    expect(url).toBe("https://wa.me/923001234567?text=Hello%20there");
  });

  it("falls back to condensed visitor messages", () => {
    const result = condensedVisitorSummary([
      { role: "CUSTOMER", content: "Hi, do you rent pontoons?" },
      { role: "AGENT", content: "Yes, we do." },
      { role: "CUSTOMER", content: "Can someone call me about Saturday?" },
    ]);
    expect(result.question).toMatch(/saturday/i);
    expect(result.summary.toLowerCase()).toContain("pontoon");
  });
});
