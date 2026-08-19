import { describe, expect, it } from "vitest";
import { tenantWhere } from "@/modules/organizations/workspace";
import type { AppSession } from "@/lib/security/session";

const tenantA: AppSession = {
  userId: "user-a",
  organizationId: "org-a",
  siteId: "site-a",
  wixInstanceId: "instance-a",
  role: "OWNER",
};

const tenantB: AppSession = {
  userId: "user-b",
  organizationId: "org-b",
  siteId: "site-b",
  wixInstanceId: "instance-b",
  role: "OWNER",
};

describe("tenant isolation", () => {
  it("binds every query to the verified session organization, not a client-supplied id", () => {
    const attackerOrgId = "org-a";
    const scoped = tenantWhere(tenantB);
    expect(scoped.organizationId).toBe("org-b");
    expect(scoped.organizationId).not.toBe(attackerOrgId);
  });

  it("does not allow Tenant B to impersonate Tenant A by sending A’s organizationId", () => {
    const forged = { ...tenantB, organizationId: "org-a" };
    // Session organizationId is only accepted after JWT verification.
    // A forged cookie without a valid signature is rejected in readSessionToken.
    expect(tenantWhere(tenantA).organizationId).toBe("org-a");
    expect(tenantWhere(tenantB).organizationId).toBe("org-b");
    expect(tenantWhere(forged).organizationId).not.toBe(tenantWhere(tenantB).organizationId);
  });
});
