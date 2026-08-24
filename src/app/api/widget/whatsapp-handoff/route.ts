import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/security/session";
import { resolveWidgetAgent } from "@/modules/widget/resolve";
import { startWhatsAppHandoff } from "@/modules/support/whatsapp-handoff";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

const bodySchema = z.object({
  conversationId: z.string().min(8).max(80),
  token: z.string().max(2000).optional().nullable(),
  instanceId: z.string().max(200).optional().nullable(),
  site: z.string().max(200).optional().nullable(),
  preview: z.boolean().optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders() });
  }

  const session = parsed.preview ? await getSession() : null;
  const agent = await resolveWidgetAgent(
    session
      ? { organizationId: session.organizationId, siteId: session.siteId }
      : { token: parsed.token, instanceId: parsed.instanceId, site: parsed.site },
  );
  if (!agent) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404, headers: corsHeaders() });
  }

  try {
    const result = await startWhatsAppHandoff({
      organizationId: agent.organizationId,
      siteId: agent.siteId,
      conversationId: parsed.conversationId,
    });
    return NextResponse.json(
      { ok: true, url: result.url, text: result.text },
      { headers: corsHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open WhatsApp" },
      { status: 400, headers: corsHeaders() },
    );
  }
}
