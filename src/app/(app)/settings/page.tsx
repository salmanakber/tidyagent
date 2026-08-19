import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { AgentStudio } from "@/components/agent/AgentStudio";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Wix is the source of truth for install and billing. Widget look is your brand, not tidyAgent’s."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Wix connection</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Site" value={data.site.displayName || "Unnamed site"} />
            <Row label="URL" value={data.site.url || "Unpublished"} />
            <Row label="Locale" value={data.site.locale || "—"} />
            <Row label="Currency" value={data.site.currency || "—"} />
            <div className="flex items-center justify-between">
              <dt className="text-navy-300">Status</dt>
              <dd>
                <StatusPill status={data.site.connectionStatus} />
              </dd>
            </div>
          </dl>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Subscription (server-side)</h2>
          <p className="mt-2 text-sm text-navy-300">
            Frontend plan badges are never trusted. Entitlements are enforced on the backend.
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Plan" value={data.entitlements.planKey} />
            <Row label="Conversations" value={String(data.entitlements.conversationLimit)} />
            <Row label="Knowledge" value={String(data.entitlements.knowledgeLimit)} />
            <Row label="Voice" value={data.entitlements.voiceEnabled ? "On" : "Off"} />
          </dl>
        </div>
      </div>
      {data.agent ? (
        <AgentStudio
          agent={{
            id: data.agent.id,
            name: data.agent.name,
            role: data.agent.role,
            personality: data.agent.personality,
            status: data.agent.status,
            widgetPrimaryColor: data.agent.widgetPrimaryColor,
            widgetGreeting: data.agent.widgetGreeting,
            widgetPosition: data.agent.widgetPosition,
            widgetEmbedMode: data.agent.widgetEmbedMode,
            widgetAvatarUrl: data.agent.widgetAvatarUrl,
            capabilities: data.agent.capabilities,
          }}
        />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-navy-300">{label}</dt>
      <dd className="truncate text-white">{value}</dd>
    </div>
  );
}
