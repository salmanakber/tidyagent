import { getSetting } from "@/lib/security/settings";
import { prisma } from "@/lib/prisma";

export async function sendResendEmail(input: { to: string[]; subject: string; html: string }) {
  const to = unique(input.to.map((item) => item.trim().toLowerCase()).filter((item) => item.includes("@")));
  if (!to.length) return { sent: false as const, reason: "no-recipient" };
  const apiKey = await getSetting("resend_api_key");
  const from = (await getSetting("resend_from_email")) || "tidyAgent <noreply@agent.tidyflowapp.com>";
  if (!apiKey) return { sent: false as const, reason: "not-configured" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject.slice(0, 180),
        html: input.html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[resend]", response.status, detail.slice(0, 300));
      return { sent: false as const, reason: "upstream" };
    }
    return { sent: true as const };
  } catch (error) {
    console.error("[resend]", error instanceof Error ? error.message : error);
    return { sent: false as const, reason: "network" };
  }
}

export async function ownerNotifyEmails(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: {
      humanAgentEmail: true,
      members: { select: { user: { select: { email: true } } }, take: 8 },
      sites: { select: { ownerEmail: true }, take: 3 },
    },
  });
  return unique(
    [
      organization?.humanAgentEmail,
      ...(organization?.members.map((row) => row.user.email) ?? []),
      ...(organization?.sites.map((row) => row.ownerEmail) ?? []),
    ].filter((item): item is string => Boolean(item)),
  );
}

export async function emailHandoffTranscript(input: {
  organizationId: string;
  conversationId: string;
  reason: "waiting" | "lead" | "whatsapp";
  lead?: { name?: string; email?: string; phone?: string | null; note?: string | null };
}) {
  const [to, conversation] = await Promise.all([
    ownerNotifyEmails(input.organizationId),
    prisma.conversation.findFirst({
      where: { id: input.conversationId, organizationId: input.organizationId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 40 },
        customer: true,
      },
    }),
  ]);
  if (!conversation) return;
  const lines = conversation.messages
    .map((row) => {
      const who = row.role === "CUSTOMER" ? "Visitor" : row.role === "HUMAN" ? "Team" : "AI";
      return `<p><strong>${who}:</strong> ${escapeHtml(row.content)}</p>`;
    })
    .join("");
  const leadBlock = input.lead
    ? `<p><strong>Lead</strong><br>${escapeHtml(input.lead.name || "")}<br>${escapeHtml(input.lead.email || "")}<br>${escapeHtml(input.lead.phone || "")}<br>${escapeHtml(input.lead.note || "")}</p>`
    : "";
  await sendResendEmail({
    to,
    subject:
      input.reason === "lead"
        ? "New chat lead from your website"
        : input.reason === "whatsapp"
          ? "A visitor continued a chat on WhatsApp"
          : "A visitor is waiting to talk to you",
    html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.5">
      <p>${
        input.reason === "lead"
          ? "A visitor left their details after waiting for a person."
          : input.reason === "whatsapp"
            ? "A visitor opened WhatsApp with a summary of the website chat. The original conversation is still in tidyAgent."
            : "A visitor asked to speak with a person. Open tidyAgent to take over the chat."
      }</p>
      ${leadBlock}
      <hr>
      ${lines || "<p>No messages yet.</p>"}
    </div>`,
  });
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
