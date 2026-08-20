import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/security/session";
import { resolveWidgetAgent } from "@/modules/widget/resolve";
import { replyToVisitor } from "@/modules/conversations/reply";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { personPayload } from "@/modules/widget/avatar";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

const bodySchema = z.object({
  message: z.string().min(1).max(1200),
  conversationId: z.string().max(80).optional().nullable(),
  visitorId: z.string().max(80).optional().nullable(),
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
    return NextResponse.json({ error: "Invalid message" }, { status: 400, headers: corsHeaders() });
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
  const suspended = agent.organization.accessStatus === "suspended";
  if (!entitlements.isPaidSeat || suspended) {
    return NextResponse.json({ error: "This AI employee is not live yet." }, { status: 403, headers: corsHeaders() });
  }
  if (!parsed.preview && agent.status !== "ACTIVE") {
    return NextResponse.json({ error: "This AI employee is not published yet." }, { status: 403, headers: corsHeaders() });
  }

  try {
    const result = await replyToVisitor({
      agent,
      message: parsed.message,
      conversationId: parsed.conversationId,
      visitorId: parsed.visitorId,
      preview: Boolean(parsed.preview),
    });
    return NextResponse.json(
      {
        conversationId: result.conversationId,
        text: result.text,
        createdAt: result.createdAt,
        agent: result.agent
          ? personPayload({ ...result.agent, widgetAvatarUrl: result.agent.avatarUrl, voiceId: result.agent.voiceId })
          : undefined,
        handoff: result.handoff
          ? {
              from: personPayload({
                ...result.handoff.from,
                widgetAvatarUrl: result.handoff.from.avatarUrl,
                voiceId: result.handoff.from.voiceId,
              }),
              to: personPayload({
                ...result.handoff.to,
                widgetAvatarUrl: result.handoff.to.avatarUrl,
                voiceId: result.handoff.to.voiceId,
              }),
            }
          : null,
      },
      { headers: corsHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reply failed" },
      { status: 502, headers: corsHeaders() },
    );
  }
}
