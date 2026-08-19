import { NextResponse } from "next/server";
import { jwtVerify, importSPKI } from "jose";
import { getEnv } from "@/lib/env";
import { provisionTenantFromWix } from "@/modules/organizations/provision";
import { fetchWixAppInstance } from "@/services/wix/client";
import { applyWixBillingWebhook, type WixWebhookEnvelope } from "@/modules/billing/service";
import { classifyWixEvent } from "@/modules/billing/lifecycle";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const env = getEnv();
  const raw = await request.text();

  try {
    const envelope = await parseWixWebhook(raw, env.WIX_APP_PUBLIC_KEY, request.headers.get("authorization"));
    const instanceId = envelope.instanceId ?? envelope.metadata?.instanceId;
    if (!instanceId) {
      return NextResponse.json({ ok: false, error: "missing instanceId" }, { status: 400, headers: corsHeaders() });
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

    return NextResponse.json({ ok: true, kind }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401, headers: corsHeaders() });
  }
}

async function parseWixWebhook(
  raw: string,
  publicKey: string,
  authorization: string | null,
): Promise<WixWebhookEnvelope> {
  const jwtCandidate = raw.includes(".") && !raw.trim().startsWith("{") ? raw : authorization?.replace(/^Bearer\s+/i, "");

  if (publicKey && jwtCandidate && jwtCandidate.split(".").length === 3) {
    const key = await importSPKI(normalizePublicKey(publicKey), "RS256");
    const { payload } = await jwtVerify(jwtCandidate, key);
    return normalizeEnvelope(payload);
  }

  if (raw.trim().startsWith("{")) {
    return normalizeEnvelope(JSON.parse(raw) as Record<string, unknown>);
  }

  throw new Error("Unverifiable webhook");
}

function normalizeEnvelope(payload: Record<string, unknown>): WixWebhookEnvelope {
  const metadata = (payload.metadata as WixWebhookEnvelope["metadata"]) ?? undefined;
  let data = payload.data as WixWebhookEnvelope["data"] | string | undefined;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as Record<string, unknown>;
    } catch {
      data = undefined;
    }
  }
  return {
    eventType: (payload.eventType as string | undefined) ?? (payload.event as string | undefined) ?? metadata?.eventType,
    instanceId:
      (payload.instanceId as string | undefined) ??
      metadata?.instanceId ??
      (data?.instanceId as string | undefined),
    uid: payload.uid as string | undefined,
    data: data as Record<string, unknown> | undefined,
    metadata,
  };
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

function normalizePublicKey(value: string) {
  if (value.includes("BEGIN PUBLIC KEY")) return value.replace(/\\n/g, "\n");
  return `-----BEGIN PUBLIC KEY-----\n${value}\n-----END PUBLIC KEY-----`;
}

function corsHeaders() {
  const appId = process.env.WIX_APP_ID ?? "";
  return {
    "Access-Control-Allow-Origin": appId ? `https://${appId}.wix.run` : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
