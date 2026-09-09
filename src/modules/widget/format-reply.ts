/**
 * Normalize agent chat text so jammed inline bullets become readable markdown.
 * Shared by dashboard preview + used as the reference for embed.js.
 */
export function normalizeAgentReplyText(value: string): string {
  let text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u202F\u2007\u2009]/g, " ")
    .trim();
  if (!text) return "";

  // "Here's how: - Phone:" → intro + real list (same line only; keep intentional blank lines)
  text = text.replace(/:[ \t]*[-•*][ \t]+/g, ":\n- ");

  // Mid-paragraph bullets before a labeled item (Phone:, Email:, **Name**:)
  text = text.replace(
    /(?<![-*\n])\s+[-•*]\s+(?=(?:\*\*)?[A-Za-z][A-Za-z0-9 /&'’-]{0,40}:)/g,
    "\n- ",
  );

  // Numbered lists jammed after a colon or mid-sentence
  text = text.replace(/:[ \t]*(?=\d+[.)][ \t]+\S)/g, ":\n");
  text = text.replace(/(?<![\n\d])\s+(\d+)[.)]\s+(?=\S)/g, "\n$1. ");

  // Closing CTA after the last bullet → its own paragraph
  text = text.replace(
    /(\n[-•*] [^\n]+|\n\d+\. [^\n]+)(\s+)(?=(?:Let me know|Which option|If you(?:'|’)d like|Happy to|I can also|Feel free)\b)/gi,
    "$1\n\n",
  );

  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
