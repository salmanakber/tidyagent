import { createHmac, timingSafeEqual } from "node:crypto";

export type WixInstancePayload = {
  instanceId: string;
  appDefId?: string;
  signDate?: string;
  uid?: string;
  permissions?: string;
  vendorProductId?: string | null;
  aid?: string;
  originInstanceId?: string;
  siteOwnerId?: string;
  demoMode?: boolean;
};

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function signaturesMatch(expected: Buffer, provided: Buffer) {
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * Verify the signed Wix `instance` query parameter using the app secret.
 * Never trust an instanceId that arrives as plain text.
 * @see https://dev.wix.com/docs/build-apps/develop-your-app/access/app-instances/parse-the-app-instance-query-parameter.md
 */
export function parseWixInstance(
  instance: string,
  appSecret: string,
): WixInstancePayload | null {
  if (!instance || !appSecret) return null;

  const [hashPart, payloadPart] = instance.split(".");
  if (!hashPart || !payloadPart) return null;

  const provided = base64UrlDecode(hashPart);
  const expected = createHmac("sha256", appSecret).update(payloadPart).digest();

  if (!signaturesMatch(expected, provided)) {
    return null;
  }

  try {
    const json = base64UrlDecode(payloadPart).toString("utf8");
    const data = JSON.parse(json) as WixInstancePayload;
    if (!data.instanceId) return null;
    return data;
  } catch {
    return null;
  }
}

export function assertNotAnonymousDashboardAccess(payload: WixInstancePayload) {
  if (payload.aid && !payload.uid) {
    throw new Error("Anonymous visitors cannot access the dashboard");
  }
}
