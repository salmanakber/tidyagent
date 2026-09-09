/**
 * Normalize agent chat text so jammed inline bullets become readable markdown.
 * Shared by dashboard preview + used as the reference for embed.js.
 */
export function normalizeAgentReplyText(value: string): string {
  let text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    // Normalize exotic list markers / dashes used as bullets
    .replace(/[•●▪◦]/g, "-")
    .trim();
  if (!text) return "";

  // "Here's how: - Phone:" → intro + real list (same line only)
  text = text.replace(/:[ \t]*[-–—][ \t]+/g, ":\n- ");

  // Mid-paragraph bullets before a labeled item (Phone:, Email:, **Name**:)
  text = text.replace(
    /(?<![-*\n])[ \t]+[-–—*][ \t]+(?=(?:\*\*)?[A-Za-z][A-Za-z0-9 /&'’-]{0,40}:)/g,
    "\n- ",
  );

  // Contact-style labels jammed in one paragraph without leading dashes
  text = text.replace(
    /(?<=[.?!:])[ \t]+(?=(?:Phone|Email|Online|Call|Text|WhatsApp|Website|Address|Hours|Location)\s*:)/gi,
    "\n- ",
  );
  text = text.replace(
    /(?<![-*\n])[ \t]+(?=(?:Phone|Email|Online|WhatsApp|Website|Address|Hours)\s*:[ \t]*\S)/gi,
    "\n- ",
  );

  // Numbered lists jammed after a colon or mid-sentence
  text = text.replace(/:[ \t]*(?=\d+[.)][ \t]+\S)/g, ":\n");
  text = text.replace(/(?<![\n\d])[ \t]+(\d+)[.)][ \t]+(?=\S)/g, "\n$1. ");

  // Closing CTA after the last bullet → its own paragraph
  text = text.replace(
    /(\n[-–—*•] [^\n]+|\n\d+\. [^\n]+)([ \t]+)(?=(?:Let me know|Which option|If you(?:'|’)d like|Happy to|I can also|Feel free|Tell me which)\b)/gi,
    "$1\n\n",
  );

  // Soft paragraph break before a trailing question after a long intro
  text = text.replace(
    /([.!?])[ \t]+(?=(?:Let me know|Which (?:option|method)|Would you like|Shall I)\b)/gi,
    "$1\n\n",
  );

  text = text
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/[ \t]{2,}/g, " ").trimEnd();
      // Ensure list lines use a consistent marker
      return trimmed.replace(/^[–—•]\s+/, "- ").replace(/^[-*]\s+/, "- ");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
