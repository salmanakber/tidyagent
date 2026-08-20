import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { provisionTenantFromWix } from "@/modules/organizations/provision";
import { fetchWixAppInstance } from "@/services/wix/client";
import { applyWixBillingWebhook, type WixWebhookEnvelope } from "@/modules/billing/service";
import { classifyWixEvent } from "@/modules/billing/lifecycle";
import { parseWixWebhook, extractWixJwt, peekWixJwtHeader } from "@/modules/billing/wix-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function keyStatus() {
  const key = process.env.WIX_APP_PUBLIC_KEY ?? "";
  return { hasPublicKey: key.trim().length > 0, keyChars: key.trim().length };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

/** Wix Trigger test only checks that POST returns 200 within 1250ms. */
function received() {
  return new NextResponse("ok", {
    status: 200,
    headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "wix-webhooks", ...keyStatus() }, { headers: corsHeaders() });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");

  // Ack first. Wix fails the Trigger test if we wait on verify / Wix APIs / DB.
  setImmediate(() => {
    void handleIncoming(raw, authorization, contentType).catch((error) => {
      const message = error instanceof Error ? error.message : "handler failed";
      console.error("[wix-webhook] background failed:", message);
    });
  });

  return received();
}

async function handleIncoming(raw: string, authorization: string | null, contentType: string | null) {
  console.info("[wix-webhook] received", {
    bytes: raw.length,
    contentType,
    hasAuth: Boolean(authorization),
    ...keyStatus(),
  });

  const env = getEnv();
  let envelope: WixWebhookEnvelope;
  try {
    envelope = await parseWixWebhook(raw, env.WIX_APP_PUBLIC_KEY, authorization);
  } catch (error) {
    const message = error instanceof Error ? error.message : "verify failed";
    const jwt = extractWixJwt(raw, authorization);
    console.error("[wix-webhook] unverified (acked 200):", message, {
      ...keyStatus(),
      jwtParts: jwt ? jwt.split(".").length : 0,
      ...peekWixJwtHeader(jwt),
    });
    return;
  }

  const instanceId = envelope.instanceId ?? envelope.metadata?.instanceId;
  if (!instanceId) {
    console.info("[wix-webhook] test ping", envelope.eventType ?? "unknown");
    return;
  }

  const kind = classifyWixEvent(envelope.eventType ?? envelope.metadata?.eventType);
  if (kind === "installed") {
    const snapshot = await fetchWixAppInstance(instanceId).catch(() => null);
    await provisionTenantFromWix({
      instance: { instanceId, uid: envelope.uid, vendorProductId: asVendor(envelope) },
      snapshot,
    });
  }
  await applyWixBillingWebhook(envelope);
  console.info("[wix-webhook] processed", kind);
}

function asVendor(envelope: WixWebhookEnvelope) {
  const data = envelope.data ?? {};
  const nested = data.payload;
  const merged =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? { ...data, ...(nested as Record<string, unknown>) }
      : data;
  const value = merged.vendorProductId ?? merged.packageName ?? merged.productId;
  return typeof value === "string" ? value : null;
}
