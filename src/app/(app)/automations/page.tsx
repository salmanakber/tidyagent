import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { ensureAgentWorkflows } from "@/app/actions/workspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { AutomationsBoard } from "@/components/automations/AutomationsBoard";

export default async function AutomationsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const workspace = await getWorkspace(session);
  if (!workspace.agent) redirect("/onboarding");
  const entitlements = await entitlementsForOrganization(session.organizationId);
  await ensureAgentWorkflows(workspace.agent.id, session.organizationId);
  const refreshed = await getWorkspace(session);
  const rows = refreshed.agent?.workflows ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Playbooks"
        title="Automations"
        description="Turn on the behaviors this AI employee should follow. What is available depends on the current plan’s scopes."
      />
      <AutomationsBoard
        planKey={entitlements.planKey}
        allowed={entitlements.automations ?? {}}
        rows={rows}
      />
    </div>
  );
}
