import { createPublicKey, createVerify } from "node:crypto";
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

export function compactJwt(value: string) {
  return value.replace(/^\uFEFF/, "").trim().replace(/\s+/g, "");
}

function b64ToBuf(segment: string) {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${pad}`, "base64");
}

export function peekWixJwtHeader(token: string) {
  try {
    const header = JSON.parse(b64ToBuf(compactJwt(token).split(".")[0] ?? "").toString("utf8")) as Record<
      string,
      unknown
    >;
    return {
      alg: typeof header.alg === "string" ? header.alg : undefined,
      typ: typeof header.typ === "string" ? header.typ : undefined,
      kid: typeof header.kid === "string" ? header.kid : undefined,
    };
  } catch {
    return {};
  }
}

function looksLikeJwt(value: string) {
  const compact = compactJwt(value);
  const parts = compact.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 8 && /^[A-Za-z0-9+/=_-]+$/.test(part));
}

export function extractWixJwt(raw: string, authorization: string | null) {
  const bearer = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  let body = raw.replace(/^\uFEFF/, "").trim();
  if (body.startsWith('"') && body.endsWith('"')) {
    try {
      body = JSON.parse(body) as string;
    } catch {
      /* keep */
    }
  }
  if (looksLikeJwt(body)) return compactJwt(body);
  if (looksLikeJwt(bearer)) return compactJwt(bearer);
  if (body.startsWith("{")) {
    try {
      const json = JSON.parse(body) as Record<string, unknown>;
      for (const value of [json.jwt, json.token, json.data, json.payload]) {
        if (typeof value === "string" && looksLikeJwt(value)) return compactJwt(value);
      }
    } catch {
      /* keep */
    }
  }
  return "";
}

let cachedKey: ReturnType<typeof createPublicKey> | null = null;
let cachedPem = "";

function nodePublicKey(publicKey: string) {
  const pem = normalizePublicKey(publicKey);
  if (cachedKey && cachedPem === pem) return cachedKey;
  cachedKey = createPublicKey(pem);
  cachedPem = pem;
  return cachedKey;
}

/** Wix sample uses jsonwebtoken + PEM. Node crypto is the same algorithm, more tolerant of base64 padding. */
export function verifyWixJwt(token: string, publicKey: string) {
  const compact = compactJwt(token);
  const parts = compact.split(".");
  if (parts.length !== 3) throw new Error("JWT does not have 3 parts");
  const [headerPart, payloadPart, signaturePart] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(b64ToBuf(headerPart).toString("utf8")) as { alg?: string };
  } catch {
    throw new Error("JWS Protected Header is invalid");
  }
  if (header.alg && header.alg !== "RS256") {
    throw new Error(`Unexpected JWT alg ${header.alg}`);
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerPart}.${payloadPart}`);
  const ok = verifier.verify(nodePublicKey(publicKey), b64ToBuf(signaturePart));
  if (!ok) throw new Error("signature verification failed");

  const payload = JSON.parse(b64ToBuf(payloadPart).toString("utf8")) as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("JWT payload is not an object");
  }
  return payload as Record<string, unknown>;
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
  const jwtCandidate = extractWixJwt(raw, authorization);

  if (jwtCandidate) {
    if (!publicKey.trim()) throw new Error("WIX_APP_PUBLIC_KEY is empty on this server");
    return unwrapWixWebhookPayload(verifyWixJwt(jwtCandidate, publicKey));
  }

  const body = raw.trim();
  if (body.startsWith("{")) {
    return unwrapWixWebhookPayload(JSON.parse(body) as Record<string, unknown>);
  }

  throw new Error("Unverifiable webhook: body is not a JWT and public key verify failed");
}
