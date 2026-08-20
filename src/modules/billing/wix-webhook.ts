import { jwtVerify, importSPKI } from "jose";
import type { WixWebhookEnvelope } from "@/modules/billing/service";

export function normalizePublicKey(value: string) {
  let pem = value.trim().replace(/\r/g, "").replace(/^["']+|["']+$/g, "");
  pem = pem.replace(/\\n/g, "\n");
  const body = pem
    .replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/g, "")
    .replace(/-----END (?:RSA )?PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("WIX_APP_PUBLIC_KEY is empty");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

/** Wix JWT is `{ data: "<json>" }` where that JSON has eventType, instanceId, and another nested data string. */
export function unwrapWixWebhookPayload(payload: Record<string, unknown>): WixWebhookEnvelope {
  let event = payload;
  const outerData = parseJsonValue(payload.data);
  const outerRecord = asRecord(outerData);
  if (outerRecord && (outerRecord.eventType || outerRecord.instanceId || outerRecord.data || outerRecord.metadata)) {
    event = outerRecord;
  }

  const metadata = asRecord(event.metadata) as WixWebhookEnvelope["metadata"] | undefined;
  const inner = parseJsonValue(event.data);
  const data = asRecord(inner) ?? undefined;

  const instanceId =
    asString(event.instanceId) ??
    asString(metadata?.instanceId) ??
    asString(data?.instanceId) ??
    asString(payload.instanceId);

  const eventType =
    asString(event.eventType) ??
    asString(event.event) ??
    asString(metadata?.eventType) ??
    asString(payload.eventType);

  return {
    eventType: eventType ?? undefined,
    instanceId: instanceId ?? undefined,
    uid: asString(event.uid) ?? asString(payload.uid) ?? undefined,
    data: data ?? (outerRecord && !data ? outerRecord : undefined),
    metadata,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function parseWixWebhook(
  raw: string,
  publicKey: string,
  authorization: string | null,
): Promise<WixWebhookEnvelope> {
  let body = raw.trim();
  if (body.startsWith('"') && body.endsWith('"')) {
    try {
      body = JSON.parse(body) as string;
    } catch {
      /* keep */
    }
  }

  const jwtCandidate =
    body.includes(".") && !body.startsWith("{") ? body : authorization?.replace(/^Bearer\s+/i, "") ?? "";

  if (publicKey && jwtCandidate && jwtCandidate.split(".").length === 3) {
    const key = await importSPKI(normalizePublicKey(publicKey), "RS256");
    const { payload } = await jwtVerify(jwtCandidate, key, {
      algorithms: ["RS256"],
      clockTolerance: 120,
    });
    return unwrapWixWebhookPayload(payload as unknown as Record<string, unknown>);
  }

  if (body.startsWith("{")) {
    return unwrapWixWebhookPayload(JSON.parse(body) as Record<string, unknown>);
  }

  throw new Error("Unverifiable webhook: body is not a JWT and public key verify failed");
}
