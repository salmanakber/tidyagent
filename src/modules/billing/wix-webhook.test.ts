import { describe, expect, it } from "vitest";
import { unwrapWixWebhookPayload } from "@/modules/billing/wix-webhook";

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
});
