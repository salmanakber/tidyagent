import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/security/session";
import { getImpersonation } from "@/lib/security/admin-session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { AppShell } from "@/components/layout/AppShell";
import { platformLabel } from "@/modules/platforms";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  const workspace = await getWorkspace(session);
  const impersonating = await getImpersonation();
  const entitlements = await entitlementsForOrganization(session.organizationId);
  const suspended = workspace.organization.accessStatus === "suspended";
  const paid = entitlements.isPaidSeat || Boolean(impersonating);
  const path = (await headers()).get("x-tidyagent-path") || "";
  const setupComplete = workspace.organization.onboardingStatus === "PUBLISHED";

  if (!paid && !path.startsWith("/billing")) {
    redirect("/billing");
  }
  if (paid && !setupComplete && !path.startsWith("/onboarding") && !path.startsWith("/billing")) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      orgName={workspace.organization.name}
      siteName={workspace.site.displayName || workspace.organization.name}
      userName={session.name}
      agentStatus={workspace.agent?.status}
      impersonating={impersonating}
      suspended={suspended}
      suspendedReason={workspace.organization.suspendedReason}
      locked={!paid}
      setupIncomplete={paid && !setupComplete}
      platformLabel={platformLabel(session.platform)}
    >
      {children}
    </AppShell>
  );
}
