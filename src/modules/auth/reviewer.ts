import type { PlanKey, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/security/passwords";
import { getSetting } from "@/lib/security/settings";
import { setSessionCookie } from "@/lib/security/session";
import { seedDefaultAgent } from "@/modules/agents/defaults";
import { PLAN_RANK } from "@/modules/billing/entitlements";

const REVIEW_INSTANCE = "reviewer:wix-app-market";

export type ReviewerConfig = {
  reviewMode: boolean;
  emails: string[];
  password: string;
};

export function parseReviewerEmails(primary?: string | null, extras?: string | null) {
  const extra = (extras ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const first = primary?.trim().toLowerCase();
  return [...(first ? [first] : []), ...extra.filter((email) => email !== first)];
}

export async function getReviewerConfig(): Promise<ReviewerConfig> {
  const env = getEnv();
  const [mode, email, password, extras] = await Promise.all([
    getSetting("wix_review_mode", env.WIX_REVIEW_MODE),
    getSetting("wix_reviewer_email", env.WIX_REVIEWER_EMAIL),
    getSetting("wix_reviewer_password", env.WIX_REVIEWER_PASSWORD),
    getSetting("wix_reviewer_emails", env.WIX_REVIEWER_EMAILS),
  ]);
  return {
    reviewMode: mode === "true",
    emails: parseReviewerEmails(email, extras),
    password,
  };
}

export async function isWixReviewMode() {
  return (await getReviewerConfig()).reviewMode;
}

export async function isReviewerEmail(email?: string | null) {
  if (!email) return false;
  const config = await getReviewerConfig();
  return config.emails.includes(email.trim().toLowerCase());
}

export function pickHigherPlan(current: PlanKey | null | undefined, grant: PlanKey): PlanKey {
  if (!current || current === "FREE") return grant;
  return PLAN_RANK[current] >= PLAN_RANK[grant] ? current : grant;
}

export function reviewComplimentaryPlan(input: {
  storedGrant?: PlanKey | null;
  ownerEmail?: string | null;
  reviewMode: boolean;
  reviewerEmails: string[];
}) {
  const stored = input.storedGrant && input.storedGrant !== "FREE" ? input.storedGrant : null;
  if (input.reviewMode) return pickHigherPlan(stored, "PRO");
  const owner = input.ownerEmail?.trim().toLowerCase();
  if (owner && input.reviewerEmails.includes(owner)) return pickHigherPlan(stored, "PRO");
  return stored;
}

/** Creates the App Market reviewer login (Pro seat, no Wix checkout). Idempotent. */
export async function ensureReviewerWorkspace() {
  const config = await getReviewerConfig();
  const email = config.emails[0];
  const password = config.password;
  if (!email || password.length < 8) {
    throw new Error("Set a reviewer email and password (min 8 characters) in Admin → Settings.");
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { wixUserId: REVIEW_INSTANCE }] },
    orderBy: { createdAt: "asc" },
  });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          name: existing.name || "Wix App Reviewer",
          passwordHash,
          wixUserId: existing.wixUserId || REVIEW_INSTANCE,
        },
      })
    : await prisma.user.create({
        data: {
          wixUserId: REVIEW_INSTANCE,
          email,
          name: "Wix App Reviewer",
          passwordHash,
        },
      });

  let site = await prisma.wixSite.findUnique({ where: { wixInstanceId: REVIEW_INSTANCE } });
  if (!site) {
    const organization = await prisma.organization.create({
      data: {
        name: "Wix App Review",
        onboardingStatus: "PUBLISHED",
        compPlanKey: "PRO",
        compGrantedAt: new Date(),
        compGrantedBy: "wix-review",
        compNote: "App Market reviewer seat — no Wix purchase required",
      },
    });
    site = await prisma.wixSite.create({
      data: {
        organizationId: organization.id,
        wixInstanceId: REVIEW_INSTANCE,
        displayName: "Wix App Review",
        url: "https://agent.tidyflowapp.com",
        ownerEmail: email,
        connectionStatus: "connected",
        lastSyncedAt: new Date(),
      },
    });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });
    const plan = await prisma.plan.upsert({
      where: { key: "PRO" },
      update: {},
      create: {
        key: "PRO",
        name: "Pro",
        conversationLimit: 25000,
        knowledgeLimit: 5000,
        voiceEnabled: true,
        advancedToolsEnabled: true,
        automationEnabled: true,
      },
    });
    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planId: plan.id,
        planKey: "PRO",
        status: "ACTIVE",
        isFree: false,
      },
    });
    await prisma.businessProfile.create({
      data: {
        organizationId: organization.id,
        siteId: site.id,
        name: "Wix App Review",
        businessType: "Demo workspace",
        industry: "Software",
        businessModel: "services",
        summary: "Reviewer workspace for tidyAgent App Market review. Complimentary Pro seat — no checkout.",
        analyzedAt: new Date(),
      },
    });
    const agent = await seedDefaultAgent({
      organizationId: organization.id,
      siteId: site.id,
      name: "Sarah",
      storesEnabled: false,
    });
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: "ACTIVE", publishedAt: new Date() },
    });
  } else {
    await prisma.organization.update({
      where: { id: site.organizationId },
      data: {
        onboardingStatus: "PUBLISHED",
        compPlanKey: "PRO",
        compGrantedAt: new Date(),
        compGrantedBy: "wix-review",
        compNote: "App Market reviewer seat — no Wix purchase required",
      },
    });
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: site.organizationId, userId: user.id } },
      update: { role: "OWNER" },
      create: { organizationId: site.organizationId, userId: user.id, role: "OWNER" },
    });
    await prisma.agent.updateMany({
      where: { organizationId: site.organizationId, siteId: site.id },
      data: { status: "ACTIVE", publishedAt: new Date() },
    });
  }

  return user;
}

export async function signInReviewer(user: User) {
  const site = await prisma.wixSite.findUniqueOrThrow({
    where: { wixInstanceId: REVIEW_INSTANCE },
  });
  await setSessionCookie({
    userId: user.id,
    organizationId: site.organizationId,
    siteId: site.id,
    wixInstanceId: site.wixInstanceId,
    role: "OWNER",
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  });
}
