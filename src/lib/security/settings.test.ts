import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-chars";
  process.env.WIDGET_TOKEN_SECRET ??= "test-widget-secret-at-least-32-chars";
});

describe("platform secret encryption", () => {
  it("round-trips a key and does not throw when the blob cannot be authenticated", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/security/settings");
    const stored = encryptSecret("sk-live-example");
    expect(decryptSecret(stored)).toBe("sk-live-example");
    expect(decryptSecret("plain-key")).toBe("plain-key");
    const broken = stored.replace(/[0-9a-f]{8}$/, "ffffffff");
    expect(decryptSecret(broken)).toBe("");
    expect(decryptSecret("enc:bad:tag:data")).toBe("");
  });
});
