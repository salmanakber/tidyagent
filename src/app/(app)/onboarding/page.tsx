import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { detectWixCapabilities } from "@/modules/wix/capabilities";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const workspace = await getWorkspace(session);
  const apps = Array.isArray(workspace.site.installedWixApps)
    ? (workspace.site.installedWixApps as string[])
    : [];
  const capabilities = detectWixCapabilities(apps).tools;

  return (
    <OnboardingWizard
      siteName={workspace.site.displayName || workspace.organization.name}
      capabilities={capabilities}
      agentName={workspace.agent?.name ?? "Sarah"}
      greeting={workspace.agent?.widgetGreeting ?? "Hi! How can I help you today?"}
      color={workspace.agent?.widgetPrimaryColor ?? "#1F3A5F"}
    />
  );
}
