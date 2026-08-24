import { waMeDigits } from "@/modules/support/phone";

export function buildWhatsAppHandoffText(input: {
  question: string;
  summary: string;
  conversationId: string;
}): string {
  const question = cleanLine(input.question, 280) || "I need help from a team member.";
  const summary = cleanLine(input.summary, 360) || question;
  const ref = input.conversationId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return [
    "Hi, I was chatting with the website assistant and need help from a team member.",
    "",
    "My question:",
    question,
    "",
    "Conversation summary:",
    summary,
    "",
    "Conversation reference:",
    `#${ref}`,
  ].join("\n");
}

export function buildWhatsAppUrl(e164OrDigits: string, text: string): string {
  const digits = waMeDigits(e164OrDigits.startsWith("+") ? e164OrDigits : `+${e164OrDigits.replace(/\D/g, "")}`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function condensedVisitorSummary(
  messages: { role: string; content: string }[],
): { question: string; summary: string } {
  const visitor = messages
    .filter((row) => isVisitorRole(row.role))
    .map((row) => row.content.trim())
    .filter((text) => text && !text.startsWith("Lead:") && !text.startsWith("Visitor continued"));
  const question = cleanLine(visitor.at(-1) || "", 280) || "I need help from a team member.";
  const prior = visitor.slice(-4, -1).map((text) => cleanLine(text, 140));
  const summary = cleanLine(prior.length ? prior.join(" · ") : question, 360) || question;
  return { question, summary };
}

function isVisitorRole(role: string) {
  const value = role.toUpperCase();
  return value === "CUSTOMER" || value === "VISITOR";
}

function cleanLine(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
