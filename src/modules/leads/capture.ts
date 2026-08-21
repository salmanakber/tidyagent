import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { emailHandoffTranscript } from "@/modules/mail/resend";
import { publishRealtime } from "@/modules/realtime/publish";

const leadSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  phone: z.string().max(40).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
});

export async function captureVisitorLead(input: {
  organizationId: string;
  siteId: string;
  conversationId: string;
  name: string;
  email: string;
  phone?: string | null;
  note?: string | null;
}) {
  const data = leadSchema.parse({
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    note: input.note?.trim() || null,
  });

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, organizationId: input.organizationId, siteId: input.siteId },
  });
  if (!conversation) throw new Error("Conversation not found");

  const existing = await prisma.customer.findFirst({
    where: { organizationId: input.organizationId, email: data.email.toLowerCase() },
  });
  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: { name: data.name, phone: data.phone || existing.phone },
      })
    : await prisma.customer.create({
        data: {
          organizationId: input.organizationId,
          siteId: input.siteId,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
        },
      });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      customerId: customer.id,
      status: "ESCALATED",
      metadata: {
        ...(typeof conversation.metadata === "object" && conversation.metadata && !Array.isArray(conversation.metadata)
          ? (conversation.metadata as Record<string, unknown>)
          : {}),
        lead: { name: data.name, email: data.email, phone: data.phone, note: data.note },
      },
    },
  });

  const summary = [data.note, data.email, data.phone].filter(Boolean).join(" · ").slice(0, 240);
  const open = await prisma.humanEscalation.findFirst({
    where: { conversationId: conversation.id, status: "open" },
  });
  if (open) {
    await prisma.humanEscalation.update({
      where: { id: open.id },
      data: { summary, reason: "visitor_lead" },
    });
  } else {
    await prisma.humanEscalation.create({
      data: {
        organizationId: input.organizationId,
        conversationId: conversation.id,
        reason: "visitor_lead",
        summary,
        status: "open",
      },
    });
  }

  await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: `Lead: ${data.name} · ${data.email}${data.phone ? ` · ${data.phone}` : ""}${data.note ? `\n${data.note}` : ""}`,
      metadata: { kind: "lead" },
    },
  });

  void emailHandoffTranscript({
    organizationId: input.organizationId,
    conversationId: conversation.id,
    reason: "lead",
    lead: data,
  }).catch(() => undefined);

  publishRealtime({
    type: "inbox",
    organizationId: input.organizationId,
    conversationId: conversation.id,
    payload: { lead: true, name: data.name, email: data.email },
  });

  return { ok: true as const, customerId: customer.id };
}
