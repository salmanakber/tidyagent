"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/security/session";
import {
  clearAdminCookie,
  requireAdminSession,
  setAdminCookie,
  setImpersonationFlag,
  verifyAdminPassword,
  type PlatformAdminRole,
} from "@/lib/security/admin-session";
import { syncSubscriptionFromWix } from "@/modules/billing/service";

export async function loginPlatformAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!(await verifyAdminPassword(email, password))) {
    redirect("/admin/login?error=1");
  }

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { lastLoginAt: new Date(), name: email.split("@")[0] },
    create: {
      email,
      name: email.split("@")[0] ?? "Owner",
      role: "SUPER",
      lastLoginAt: new Date(),
    },
  });

  await setAdminCookie({
    type: "platform",
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role as PlatformAdminRole,
  });
  redirect("/admin");
}

export async function logoutPlatformAdmin() {
  await clearAdminCookie();
  redirect("/admin/login");
}

async function writeAudit(action: string, metadata: Record<string, unknown> = {}) {
  const admin = await requireAdminSession("SUPPORT");
  await prisma.platformAuditLog.create({
    data: {
      adminId: admin.adminId,
      adminEmail: admin.email,
      action,
      organizationId: typeof metadata.organizationId === "string" ? metadata.organizationId : undefined,
      siteId: typeof metadata.siteId === "string" ? metadata.siteId : undefined,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function suspendSite(siteId: string, reason: string) {
  const admin = await requireAdminSession("SUPER");
  const site = await prisma.wixSite.findUniqueOrThrow({ where: { id: siteId } });
  await prisma.organization.update({
    where: { id: site.organizationId },
    data: { accessStatus: "suspended", suspendedAt: new Date(), suspendedReason: reason },
  });
  await prisma.wixSite.update({
    where: { id: siteId },
    data: { accessStatus: "suspended", suspendedAt: new Date(), suspendedReason: reason },
  });
  await prisma.agent.updateMany({
    where: { organizationId: site.organizationId, siteId },
    data: { status: "PAUSED" },
  });
  await writeAudit("site.suspend", { siteId, organizationId: site.organizationId, reason, admin: admin.email });
}

export async function restoreSite(siteId: string) {
  await requireAdminSession("SUPER");
  const site = await prisma.wixSite.findUniqueOrThrow({ where: { id: siteId } });
  await prisma.organization.update({
    where: { id: site.organizationId },
    data: { accessStatus: "active", suspendedAt: null, suspendedReason: null },
  });
  await prisma.wixSite.update({
    where: { id: siteId },
    data: { accessStatus: "active", suspendedAt: null, suspendedReason: null },
  });
  await writeAudit("site.restore", { siteId, organizationId: site.organizationId });
}

export async function syncSiteBilling(siteId: string) {
  await requireAdminSession("SUPPORT");
  const site = await prisma.wixSite.findUniqueOrThrow({ where: { id: siteId } });
  await syncSubscriptionFromWix(site.wixInstanceId);
  await writeAudit("billing.sync", { siteId, organizationId: site.organizationId, wixInstanceId: site.wixInstanceId });
}

export async function grantComplimentaryPlan(siteId: string, planKey: "STARTER" | "GROWTH" | "PRO", note?: string) {
  const admin = await requireAdminSession("SUPER");
  const site = await prisma.wixSite.findUniqueOrThrow({ where: { id: siteId } });
  await prisma.organization.update({
    where: { id: site.organizationId },
    data: {
      compPlanKey: planKey,
      compGrantedAt: new Date(),
      compGrantedBy: admin.email,
      compNote: note?.slice(0, 200) || null,
    },
  });
  await writeAudit("billing.comp.grant", {
    siteId,
    organizationId: site.organizationId,
    planKey,
    note,
    admin: admin.email,
  });
  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${siteId}`);
}

export async function revokeComplimentaryPlan(siteId: string) {
  const admin = await requireAdminSession("SUPER");
  const site = await prisma.wixSite.findUniqueOrThrow({ where: { id: siteId } });
  await prisma.organization.update({
    where: { id: site.organizationId },
    data: {
      compPlanKey: null,
      compGrantedAt: null,
      compGrantedBy: null,
      compNote: null,
    },
  });
  await writeAudit("billing.comp.revoke", {
    siteId,
    organizationId: site.organizationId,
    admin: admin.email,
  });
  revalidatePath("/admin/sites");
  revalidatePath(`/admin/sites/${siteId}`);
}

export async function openSiteAsOwner(siteId: string) {
  const admin = await requireAdminSession("SUPPORT");
  const site = await prisma.wixSite.findUniqueOrThrow({
    where: { id: siteId },
    include: { organization: { include: { members: true } } },
  });
  const member = site.organization.members[0];
  if (!member) throw new Error("No owner membership on this site");

  await setSessionCookie({
    userId: member.userId,
    organizationId: site.organizationId,
    siteId: site.id,
    wixInstanceId: site.wixInstanceId,
    role: "OWNER",
    email: site.ownerEmail ?? undefined,
    name: site.displayName ?? site.organization.name,
  });
  await setImpersonationFlag(admin.email);
  await writeAudit("site.impersonate", { siteId, organizationId: site.organizationId });
  redirect("/dashboard");
}
