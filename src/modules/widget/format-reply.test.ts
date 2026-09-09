import { describe, expect, it } from "vitest";
import { normalizeAgentReplyText } from "@/modules/widget/format-reply";

describe("normalizeAgentReplyText", () => {
  it("breaks jammed dash lists into readable bullets", () => {
    const raw =
      "Sure thing! Here’s how we can get it done: - Phone: (406) 261-5921 – call to confirm. - Email: info@406watersports.com – send a note. - Online: book through our site. Let me know which method works best for you!";
    const next = normalizeAgentReplyText(raw);
    expect(next).toContain("done:\n- Phone:");
    expect(next).toContain("\n- Email:");
    expect(next).toContain("\n- Online:");
    expect(next).toContain("\n\nLet me know which method works best for you!");
  });

  it("splits contact labels without leading dashes", () => {
    const raw =
      "I can help with that. Phone: (406) 261-5921. Email: info@example.com. Let me know which works.";
    const next = normalizeAgentReplyText(raw);
    expect(next).toContain("\n- Phone:");
    expect(next).toContain("\n- Email:");
  });

  it("keeps already-formatted multiline replies stable", () => {
    const raw = "Here are options:\n\n- **Morning** — $99\n- **Afternoon** — $120\n\nWhich works?";
    expect(normalizeAgentReplyText(raw)).toBe(raw);
  });
});
