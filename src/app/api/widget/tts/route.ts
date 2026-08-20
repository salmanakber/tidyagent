import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/security/session";
import { resolveWidgetAgent } from "@/modules/widget/resolve";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { synthesizeSpeechDetailed } from "@/modules/voice/tts";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

const bodySchema = z.object({
  text: z.string().min(1).max(800),
  token: z.string().max(2000).optional().nullable(),
  instanceId: z.string().max(200).optional().nullable(),
  site: z.string().max(200).optional().nullable(),
  preview: z.boolean().optional(),
  voiceId: z.string().max(80).optional().nullable(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid text" }, { status: 400, headers: corsHeaders() });
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

  const entitlements = await entitlementsForOrganization(agent.organizationId);
  if (!entitlements.voiceEnabled || !agent.voiceEnabled) {
    return NextResponse.json({ error: "Voice is included on Pro." }, { status: 403, headers: corsHeaders() });
  }

  const spoken = await synthesizeSpeechDetailed(parsed.text, parsed.voiceId || agent.voiceId);
  if (!spoken.ok) {
    return NextResponse.json({ error: spoken.error }, { status: 503, headers: corsHeaders() });
  }

  return new NextResponse(new Uint8Array(spoken.bytes), {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": spoken.contentType,
      "Content-Length": String(spoken.bytes.length),
      "X-Tidyagent-Tts": spoken.provider,
      "X-Tidyagent-Voice": spoken.voice,
    },
  });
}
