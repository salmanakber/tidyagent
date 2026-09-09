import { describe, expect, it } from "vitest";
import { safeHttpUrl, safeWhatsAppUrl } from "@/modules/widget/safe-url";

describe("widget safe urls", () => {
  it("allows only http(s) product and media links", () => {
    expect(safeHttpUrl("https://shop.example.com/p/1")).toBe("https://shop.example.com/p/1");
    expect(safeHttpUrl("http://shop.example.com/p/1")).toBe("http://shop.example.com/p/1");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("vbscript:msg")).toBeNull();
  });

  it("allows only known WhatsApp hosts", () => {
    expect(safeWhatsAppUrl("https://wa.me/15551234567")).toContain("wa.me");
    expect(safeWhatsAppUrl("https://api.whatsapp.com/send?phone=1")).toContain("api.whatsapp.com");
    expect(safeWhatsAppUrl("https://evil.example/wa.me")).toBeNull();
    expect(safeWhatsAppUrl("javascript:alert(1)")).toBeNull();
  });
});
