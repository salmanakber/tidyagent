import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { isPlatformReviewMode } from "@/modules/auth/reviewer";
import { platformLabel, isWebflowPlatform, isShopifyPlatform } from "@/modules/platforms";
import { webflowWidgetStatus } from "@/modules/webflow/embed";
import { shopifyWidgetStatus } from "@/modules/shopify/embed";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { DashboardTestChat } from "@/components/dashboard/DashboardTestChat";
import { publicSupportChannels } from "@/modules/support/channels";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const [data, testingMode] = await Promise.all([
    getDashboardOverview(session),
    isPlatformReviewMode(session.platform),
  ]);
  const siteName = data.site.displayName ?? `Your ${platformLabel(session.platform)} site`;
  const webflowWidget = isWebflowPlatform(session.platform)
    ? await webflowWidgetStatus(session.siteId)
    : null;
  const shopifyWidget = isShopifyPlatform(session.platform)
    ? await shopifyWidgetStatus(session.siteId)
    : null;
  const widgetNotice = webflowWidget ?? shopifyWidget;
  const widgetHost = isShopifyPlatform(session.platform) ? "Shopify" : "Webflow";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AI employee"
        title={data.agent?.name ?? "Your AI employee"}
        description={`${siteName} is connected. Answers stay evidence-based. Sensitive actions stay behind confirmation.`}
        actions={
          <>
            <StatusPill status={data.agent?.status ?? "DRAFT"} />
            <Link href="/onboarding" className="btn-secondary">
              Setup wizard
            </Link>
            {testingMode ? (
              <a href="#test-ai" className="btn-primary">
                Test AI
              </a>
            ) : null}
          </>
        }
      />

      {widgetNotice ? (
        <div className="panel p-4 text-sm leading-6 text-navy-300">
          {widgetNotice.error ? (
            <>
              The chat widget was not applied on {widgetHost} ({widgetNotice.error}). Open the app again after
              confirming script / custom-code permission.
            </>
          ) : (
            <>
              The chat widget is attached on this {widgetHost} site
              {widgetNotice.injectedAt ? ` (updated ${widgetNotice.injectedAt})` : ""}.
              {isWebflowPlatform(session.platform)
                ? " Publish the Webflow site if visitors do not see the bubble yet."
                : " Reload the storefront if visitors do not see the bubble yet."}
            </>
          )}
        </div>
      ) : null}

      {testingMode && data.agent ? (
        <div id="test-ai">
          <DashboardTestChat
            name={data.agent.name}
            greeting={data.agent.widgetGreeting}
            primaryColor={data.agent.widgetPrimaryColor}
            useGradient={data.agent.widgetUseGradient}
            gradientTo={data.agent.widgetGradientTo}
            gradientAngle={data.agent.widgetGradientAngle}
            textColor={data.agent.widgetTextColor}
            messageColor={data.agent.widgetMessageColor}
            position={data.agent.widgetPosition}
            avatarUrl={data.agent.widgetAvatarUrl}
            template={data.agent.widgetTemplate}
            voiceEnabled={data.entitlements.voiceEnabled && data.agent.voiceEnabled}
            whatsappDigits={publicSupportChannels(data.organization.humanAgentWhatsapp).whatsapp?.digits}
          />
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Conversations" value={formatNumber(data.metrics.conversations)} hint="All conversations" />
        <MetricCard label="Resolved by AI" value={formatNumber(data.metrics.resolvedByAi)} />
        <MetricCard label="Human escalations" value={formatNumber(data.metrics.humanEscalations)} />
        <MetricCard label="Leads" value={formatNumber(data.metrics.leads)} hint={`${formatNumber(data.metrics.salesAssisted)} sales assisted`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Top questions</h2>
          <div className="mt-5 space-y-3">
            {data.topQuestions.length ? (
              data.topQuestions.map((item, index) => (
              <div key={item.topic} className="flex items-center justify-between rounded-2xl bg-navy-950/40 px-4 py-3">
                <div>
                  <p className="text-sm text-white">
                    {index + 1}. {item.topic}
                  </p>
                  <p className="text-xs text-navy-300">{item.question}</p>
                </div>
                <span className="text-xs text-amber-300">{item.occurrences}×</span>
              </div>
              ))
            ) : (
              <p className="text-sm text-navy-300">Questions from live chats will show here after visitors start talking.</p>
            )}
          </div>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">AI health</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <Row label="Knowledge coverage" value={`${data.metrics.knowledgeCoverage}%`} />
            <Row label="Unanswered questions" value={String(data.metrics.unanswered)} />
            <Row label="Improvement suggestions" value={String(data.metrics.improvementSuggestions)} />
            <Row label="Plan" value={data.entitlements.planKey} />
            <Row label="Site" value={data.site.connectionStatus} />
          </dl>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-navy-300">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}
