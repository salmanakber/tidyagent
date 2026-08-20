import { describe, expect, it } from "vitest";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { normalizePublicKey, parseWixWebhook, unwrapWixWebhookPayload, extractWixJwt } from "@/modules/billing/wix-webhook";

describe("Wix webhook unwrap", () => {
  it("reads instanceId from the nested JWT data string", () => {
    const envelope = unwrapWixWebhookPayload({
      iat: 1,
      data: JSON.stringify({
        eventType: "AppInstanceInstalled",
        instanceId: "site-abc",
        data: JSON.stringify({ vendorProductId: "starter" }),
      }),
    });
    expect(envelope.instanceId).toBe("site-abc");
    expect(envelope.eventType).toBe("AppInstanceInstalled");
    expect(envelope.data?.vendorProductId).toBe("starter");
  });

  it("allows a signed test ping with no instance", () => {
    const envelope = unwrapWixWebhookPayload({
      data: JSON.stringify({ eventType: "AppInstanceInstalled" }),
    });
    expect(envelope.instanceId).toBeUndefined();
    expect(envelope.eventType).toBe("AppInstanceInstalled");
  });

  it("rebuilds a valid PEM from messy .env whitespace", () => {
    const pem = normalizePublicKey(
      ' "-----BEGIN PUBLIC KEY----- MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA dwIDAQAB -----END PUBLIC KEY-----" ',
    );
    expect(pem.startsWith("-----BEGIN PUBLIC KEY-----\n")).toBe(true);
    expect(pem.endsWith("\n-----END PUBLIC KEY-----")).toBe(true);
    expect(pem.includes("MIIBIjAN")).toBe(true);
    expect(pem.split("\n")[1].includes(" ")).toBe(false);
  });

  it("verifies a Wix-style JWT even if the PEM has spaces instead of newlines", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const spki = await exportSPKI(publicKey);
    const jwt = await new SignJWT({
      data: JSON.stringify({ eventType: "AppInstanceInstalled" }),
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .sign(privateKey);

    const envelope = await parseWixWebhook(jwt, spki.replace(/\n/g, " "), null);
    expect(envelope.eventType).toBe("AppInstanceInstalled");
    expect(envelope.instanceId).toBeUndefined();
  });

  it("verifies a JWT even if Wix wraps it with newlines", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const spki = await exportSPKI(publicKey);
    const jwt = await new SignJWT({
      data: JSON.stringify({ eventType: "AppInstanceInstalled" }),
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt()
      .sign(privateKey);

    const wrapped = `${jwt.slice(0, 40)}\n${jwt.slice(40)}`;
    const envelope = await parseWixWebhook(wrapped, spki, null);
    expect(envelope.eventType).toBe("AppInstanceInstalled");
  });

  it("finds a JWT in the raw body or Authorization header", () => {
    const jwt = `${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`;
    expect(extractWixJwt(jwt, null)).toBe(jwt);
    expect(extractWixJwt("{}", `Bearer ${jwt}`)).toBe(jwt);
    expect(extractWixJwt(JSON.stringify({ data: jwt }), null)).toBe(jwt);
    expect(extractWixJwt(`garbage eyJ${"h".repeat(20)}.${"p".repeat(20)}.${"s".repeat(20)}`, null)).toBe(
      `eyJ${"h".repeat(20)}.${"p".repeat(20)}.${"s".repeat(20)}`,
    );
    expect(extractWixJwt("{}", null)).toBe("");
  });

  it("treats an empty Trigger test POST as a ping, not an error", async () => {
    const envelope = await parseWixWebhook("", "", null);
    expect(envelope.eventType).toBe("wix.test");
    expect(envelope.instanceId).toBeUndefined();
  });
});
