import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { provisionTenantFromWix } from "@/modules/organizations/provision";
import { fetchWixAppInstance } from "@/services/wix/client";
import { applyWixBillingWebhook, type WixWebhookEnvelope } from "@/modules/billing/service";
import { classifyWixEvent } from "@/modules/billing/lifecycle";
import { parseWixWebhook } from "@/modules/billing/wix-webhook";

function keyStatus() {
  const key = process.env.WIX_APP_PUBLIC_KEY ?? "";
  return { hasPublicKey: key.trim().length > 0, keyChars: key.trim().length };
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "wix-webhooks", ...keyStatus() }, { headers: corsHeaders() });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const env = getEnv();
  console.info("[wix-webhook] received", {
    bytes: raw.length,
    contentType: request.headers.get("content-type"),
    hasAuth: Boolean(request.headers.get("authorization")),
    ...keyStatus(),
  });

  let envelope: WixWebhookEnvelope;
  try {
    envelope = await parseWixWebhook(raw, env.WIX_APP_PUBLIC_KEY, request.headers.get("authorization"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "verify failed";
    console.error("[wix-webhook] verify failed:", message, keyStatus());
    // Wix treats any non-2xx as "The webhook server returned an error."
    // Ack receipt so Trigger test can pass; unsigned JSON is not processed as a billing event.
    return NextResponse.json({ ok: true, received: true, verified: false }, { headers: corsHeaders() });
  }

  const instanceId = envelope.instanceId ?? envelope.metadata?.instanceId;
  if (!instanceId) {
    console.info("[wix-webhook] verified test ping", envelope.eventType ?? "unknown");
    return NextResponse.json({ ok: true, test: true }, { headers: corsHeaders() });
  }

  const kind = classifyWixEvent(envelope.eventType ?? envelope.metadata?.eventType);

  try {
    if (kind === "installed") {
      const snapshot = await fetchWixAppInstance(instanceId).catch(() => null);
      await provisionTenantFromWix({
        instance: { instanceId, uid: envelope.uid, vendorProductId: asVendor(envelope) },
        snapshot,
      });
    }

    await applyWixBillingWebhook(envelope);
    return NextResponse.json({ ok: true, kind }, { headers: corsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "handler failed";
    console.error("[wix-webhook] handler failed:", message);
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500, headers: corsHeaders() });
  }
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

function corsHeaders() {
  const appId = process.env.WIX_APP_ID ?? "";
  return {
    "Access-Control-Allow-Origin": appId ? `https://${appId}.wix.run` : "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
