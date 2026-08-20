import { processWixSdkWebhook } from "@/modules/wix/webhook-sdk";
import { extractWixJwt, peekWixJwtHeader } from "@/modules/billing/wix-webhook";

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

  try {
    await processWixSdkWebhook(raw, authorization);
  } catch (error) {
    const jwt = extractWixJwt(raw, authorization);
    console.error("[wix-webhook] unverified (acked 200):", error instanceof Error ? error.message : "verify failed", {
      ...keyStatus(),
      bytes: raw.length,
      bodyStart: raw.trim().slice(0, 48).replace(/[^\x20-\x7e]/g, "."),
      jwtParts: jwt ? jwt.split(".").length : 0,
      ...peekWixJwtHeader(jwt),
    });
  }
}
