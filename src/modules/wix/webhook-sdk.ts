import { AppStrategy, createClient } from "@wix/sdk";
import { appInstances } from "@wix/app-management";
import { getEnv } from "@/lib/env";
import { provisionTenantFromWix } from "@/modules/organizations/provision";
import { fetchWixAppInstance } from "@/services/wix/client";
import { applyWixBillingWebhook, type WixWebhookEnvelope } from "@/modules/billing/service";
import { classifyWixEvent } from "@/modules/billing/lifecycle";
import { extractWixJwt, normalizePublicKey, parseWixWebhook } from "@/modules/billing/wix-webhook";

type SdkEvent = {
  data?: unknown;
  metadata?: {
    instanceId?: string | null;
    eventType?: string | null;
  } | null;
};

type Processor = {
  process(body: string): Promise<void>;
};

let processor: Processor | null = null;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function envelopeFromSdk(event: SdkEvent, fallbackType: string): WixWebhookEnvelope {
  const instanceId = event.metadata?.instanceId ?? undefined;
  const eventType = event.metadata?.eventType ?? fallbackType;
  return {
    eventType,
    instanceId,
    data: asRecord(event.data),
    metadata: { instanceId, eventType },
  };
}

function vendorFrom(envelope: WixWebhookEnvelope) {
  const data = envelope.data ?? {};
  const nested = data.payload;
  const merged =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? { ...data, ...(nested as Record<string, unknown>) }
      : data;
  const value = merged.vendorProductId ?? merged.packageName ?? merged.productId;
  return typeof value === "string" ? value : null;
}

async function applyEnvelope(envelope: WixWebhookEnvelope) {
  const instanceId = envelope.instanceId ?? envelope.metadata?.instanceId;
  if (!instanceId) {
    console.info("[wix-webhook] test ping", envelope.eventType ?? "unknown");
    return;
  }

  const kind = classifyWixEvent(envelope.eventType ?? envelope.metadata?.eventType);
  if (kind === "installed") {
    const snapshot = await fetchWixAppInstance(instanceId).catch(() => null);
    await provisionTenantFromWix({
      instance: { instanceId, uid: envelope.uid, vendorProductId: vendorFrom(envelope) },
      snapshot,
    });
  }
  await applyWixBillingWebhook(envelope);
  console.info("[wix-webhook] processed", kind);
}

function getProcessor(): Processor {
  if (processor) return processor;

  const env = getEnv();
  const client = createClient({
    auth: AppStrategy({
      appId: env.WIX_APP_ID,
      publicKey: env.WIX_APP_PUBLIC_KEY ? normalizePublicKey(env.WIX_APP_PUBLIC_KEY) : undefined,
    }),
    modules: { appInstances },
  });

  const bind = (fallbackType: string) => (event: SdkEvent) => {
    void applyEnvelope(envelopeFromSdk(event, fallbackType)).catch((error) => {
      console.error("[wix-webhook] handler failed:", error instanceof Error ? error.message : error);
    });
  };

  client.appInstances.onAppInstanceInstalled(bind("AppInstanceInstalled"));
  client.appInstances.onAppInstanceRemoved(bind("AppInstanceRemoved"));
  client.appInstances.onAppInstancePaidPlanPurchased(bind("PaidPlanPurchased"));
  client.appInstances.onAppInstancePaidPlanChanged(bind("PaidPlanChanged"));
  client.appInstances.onAppInstancePaidPlanAutoRenewalCancelled(bind("PaidPlanAutoRenewalCancelled"));

  processor = {
    process: async (body: string) => {
      await client.webhooks.process(body);
    },
  };
  return processor;
}

/** Same verify path as Wix’s dashboard sample: client.webhooks.process(body). */
export async function processWixSdkWebhook(raw: string, authorization: string | null) {
  const trimmed = raw.trim();
  if (!trimmed && !authorization) {
    console.info("[wix-webhook] empty ping");
    return;
  }

  const jwt = extractWixJwt(raw, authorization);
  const bodies = [...new Set([trimmed, jwt].filter(Boolean))];
  const sdk = getProcessor();
  let lastError: unknown;

  for (const body of bodies) {
    try {
      await sdk.process(body);
      console.info("[wix-webhook] sdk process ok");
      return;
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const envelope = await parseWixWebhook(raw, getEnv().WIX_APP_PUBLIC_KEY, authorization);
    await applyEnvelope(envelope);
  } catch (fallbackError) {
    const sdkMessage = lastError instanceof Error ? lastError.message : "sdk process failed";
    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "fallback failed";
    throw new Error(`${sdkMessage}; ${fallbackMessage}`);
  }
}
