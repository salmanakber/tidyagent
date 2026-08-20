import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { siteFactsFromApps } from "@/modules/knowledge/site-facts";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgentStudio } from "@/components/agent/AgentStudio";

export default async function AgentPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const workspace = await getWorkspace(session);
  if (!workspace.agent) redirect("/onboarding");
  const entitlements = await entitlementsForOrganization(session.organizationId);
  const facts = siteFactsFromApps(workspace.site.installedWixApps);

  const agents = workspace.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    personality: agent.personality,
    status: agent.status,
    widgetPrimaryColor: agent.widgetPrimaryColor,
    widgetUseGradient: agent.widgetUseGradient,
    widgetGradientTo: agent.widgetGradientTo,
    widgetGradientAngle: agent.widgetGradientAngle,
    widgetTextColor: agent.widgetTextColor,
    widgetMessageColor: agent.widgetMessageColor,
    widgetGreeting: agent.widgetGreeting,
    widgetPosition: agent.widgetPosition,
    widgetEmbedMode: agent.widgetEmbedMode,
    widgetAvatarUrl: agent.widgetAvatarUrl,
    widgetTemplate: agent.widgetTemplate,
    voiceEnabled: agent.voiceEnabled,
    voiceId: agent.voiceId,
    isPrimary: agent.isPrimary,
    specialty: agent.specialty,
    knowledgeScopes: agent.knowledgeScopes,
    capabilities: agent.capabilities,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your AI employee"
        title={workspace.agent.name}
        description="Widget look, voice, and specialists. Each specialist only sees the website data you assign."
      />
      <AgentStudio
        agent={agents.find((row) => row.id === workspace.agent?.id) ?? agents[0]}
        agents={agents}
        planKey={entitlements.planKey}
        voiceOnPlan={entitlements.voiceEnabled}
        allTemplates={entitlements.allTemplates}
        maxAgents={entitlements.maxAgents}
        hasStores={facts.hasStores}
        hasBookings={facts.hasBookings}
        hasBlog={facts.hasBlog}
        hasEvents={facts.hasEvents}
        contentTypes={facts.contentTypes}
        presentCapabilities={facts.toolsPresent.map((tool) => tool.key)}
      />
    </div>
  );
}
