import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { detectWixCapabilities } from "@/modules/wix/capabilities";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { planLabel } from "@/modules/billing/catalog";
import { scanScopeFromConfig } from "@/modules/knowledge/scan-scope";
import { getPlanScope } from "@/modules/billing/plan-scope-store";
import type { SiteUnderstanding } from "@/modules/knowledge/types";

export const maxDuration = 120;

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const workspace = await getWorkspace(session);
  const entitlements = await entitlementsForOrganization(session.organizationId);
  const planScope = await getPlanScope(entitlements.planKey);
  const scope = scanScopeFromConfig(entitlements.planKey, planScope);
  const apps = Array.isArray(workspace.site.installedWixApps)
    ? (workspace.site.installedWixApps as string[])
    : [];
  const capabilities = detectWixCapabilities(apps).tools;
  const existingUnderstanding = asUnderstanding(workspace.profile?.structured);

  return (
    <OnboardingWizard
      siteName={workspace.site.displayName || workspace.organization.name}
      siteUrl={workspace.site.url}
      planLabel={planLabel(entitlements.planKey)}
      scopeNote={scope.depthNote}
      capabilities={capabilities.filter((item) => item.available)}
      agentName={workspace.agent?.name ?? "Sarah"}
      greeting={workspace.agent?.widgetGreeting ?? "Hi! How can I help you today?"}
      color={workspace.agent?.widgetPrimaryColor ?? "#1F3A5F"}
      avatarUrl={workspace.agent?.widgetAvatarUrl}
      existingUnderstanding={existingUnderstanding}
      humanName={workspace.organization.humanAgentName}
      humanRole={workspace.organization.humanAgentRole}
      humanEmail={workspace.organization.humanAgentEmail}
      humanAvatarUrl={workspace.organization.humanAgentAvatarUrl}
      humanWhatsapp={workspace.organization.humanAgentWhatsapp}
    />
  );
}

function asUnderstanding(value: unknown): SiteUnderstanding | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SiteUnderstanding>;
  if (!row.name || !row.summary) return null;
  return {
    name: row.name,
    industry: row.industry || "Local business",
    businessType: row.businessType || "Website",
    businessModel: row.businessModel || "Customer service",
    summary: row.summary,
    audience: row.audience || "",
    tone: row.tone || "",
    offerings: row.offerings ?? [],
    faqs: row.faqs ?? [],
    policies: row.policies ?? [],
    contact: row.contact ?? { emails: [], phones: [] },
    differentiators: row.differentiators ?? [],
    confidence: row.confidence ?? "low",
  };
}
