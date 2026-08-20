import { getEnv } from "@/lib/env";
import { provisionTenantFromWix } from "@/modules/organizations/provision";
import { fetchWixAppInstance } from "@/services/wix/client";
import { applyWixBillingWebhook, type WixWebhookEnvelope } from "@/modules/billing/service";
import { classifyWixEvent } from "@/modules/billing/lifecycle";
import { parseWixWebhook, extractWixJwt, peekWixJwtHeader, decodeWixJwtUnsafe } from "@/modules/billing/wix-webhook";

function keyStatus() {
  const key = process.env.WIX_APP_PUBLIC_KEY ?? "";
  return { hasPublicKey: key.trim().length > 0, keyChars: key.trim().length };
}

export async function handleWixWebhook(raw: string, authorization: string | null, contentType: string | null) {
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
    const decoded = jwt ? decodeWixJwtUnsafe(jwt) : null;
    console.error("[wix-webhook] unverified (acked 200):", message, {
      ...keyStatus(),
      bytes: raw.length,
      bodyStart: raw.trim().slice(0, 48).replace(/[^\x20-\x7e]/g, "."),
      jwtParts: jwt ? jwt.split(".").length : 0,
      ...peekWixJwtHeader(jwt),
      eventType: typeof decoded?.data === "string" ? decoded.data.slice(0, 80) : decoded?.eventType,
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
