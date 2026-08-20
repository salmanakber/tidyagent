import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { provisionTenantFromWix } from "@/modules/organizations/provision";
import { fetchWixAppInstance } from "@/services/wix/client";
import { applyWixBillingWebhook, type WixWebhookEnvelope } from "@/modules/billing/service";
import { classifyWixEvent } from "@/modules/billing/lifecycle";
import { parseWixWebhook } from "@/modules/billing/wix-webhook";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const env = getEnv();
  const raw = await request.text();

  let envelope: WixWebhookEnvelope;
  try {
    envelope = await parseWixWebhook(raw, env.WIX_APP_PUBLIC_KEY, request.headers.get("authorization"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "verify failed";
    console.error("[wix-webhook] verify failed:", message);
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 401, headers: corsHeaders() });
  }

  const instanceId = envelope.instanceId ?? envelope.metadata?.instanceId;
  if (!instanceId) {
    // Wix "Trigger test" signs a JWT but often omits a real site instance.
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
