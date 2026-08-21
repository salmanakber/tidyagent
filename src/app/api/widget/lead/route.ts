import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/security/session";
import { resolveWidgetAgent } from "@/modules/widget/resolve";
import { captureVisitorLead } from "@/modules/leads/capture";

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
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  phone: z.string().max(40).optional().nullable(),
  note: z.string().max(800).optional().nullable(),
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
    return NextResponse.json({ error: "Check name and email" }, { status: 400, headers: corsHeaders() });
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
    await captureVisitorLead({
      organizationId: agent.organizationId,
      siteId: agent.siteId,
      conversationId: parsed.conversationId,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      note: parsed.note,
    });
    return NextResponse.json({ ok: true }, { headers: corsHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save" },
      { status: 400, headers: corsHeaders() },
    );
  }
}
