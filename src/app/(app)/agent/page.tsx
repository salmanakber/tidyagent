import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgentStudio } from "@/components/agent/AgentStudio";

export default async function AgentPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const workspace = await getWorkspace(session);
  if (!workspace.agent) redirect("/onboarding");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your AI employee"
        title={workspace.agent.name}
        description="Configuration stays simple. Tools, knowledge, and handoff are decided for you — you can still refine."
      />
      <AgentStudio
        agent={{
          id: workspace.agent.id,
          name: workspace.agent.name,
          role: workspace.agent.role,
          personality: workspace.agent.personality,
          status: workspace.agent.status,
          widgetPrimaryColor: workspace.agent.widgetPrimaryColor,
          widgetGreeting: workspace.agent.widgetGreeting,
          widgetPosition: workspace.agent.widgetPosition,
          widgetEmbedMode: workspace.agent.widgetEmbedMode,
          widgetAvatarUrl: workspace.agent.widgetAvatarUrl,
          capabilities: workspace.agent.capabilities,
        }}
      />
    </div>
  );
}
