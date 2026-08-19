import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWixInstance } from "@/lib/security/instance";

function encodeInstance(payload: object, secret: string) {
  const data = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const signature = createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signature}.${data}`;
}

describe("parseWixInstance", () => {
  const secret = "wix-app-secret";

  it("accepts a valid signed instance", () => {
    const instance = encodeInstance({ instanceId: "abc-123", uid: "user-1" }, secret);
    const parsed = parseWixInstance(instance, secret);
    expect(parsed?.instanceId).toBe("abc-123");
    expect(parsed?.uid).toBe("user-1");
  });

  it("rejects a tampered instanceId", () => {
    const instance = encodeInstance({ instanceId: "abc-123" }, secret);
    const [sig, data] = instance.split(".");
    const tamperedData = Buffer.from(JSON.stringify({ instanceId: "evil-id" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    expect(parseWixInstance(`${sig}.${tamperedData}`, secret)).toBeNull();
  });

  it("rejects an unsigned plain instanceId", () => {
    expect(parseWixInstance("plain-text-id", secret)).toBeNull();
  });
});
