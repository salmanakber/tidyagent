import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { isPlatformReviewMode } from "@/modules/auth/reviewer";
import { platformLabel, isWebflowPlatform, isShopifyPlatform } from "@/modules/platforms";
import { webflowWidgetStatus } from "@/modules/webflow/embed";
import { shopifyWidgetStatus } from "@/modules/shopify/embed";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { DashboardTestChat } from "@/components/dashboard/DashboardTestChat";
import { KnowledgeCollectionBoard } from "@/components/knowledge/KnowledgeCollectionBoard";
import { publicSupportChannels } from "@/modules/support/channels";
import { parseScanSourceMeta, scanSnapshotFromStore } from "@/modules/knowledge/scan-snapshot";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { planLabel } from "@/modules/billing/catalog";
import { scanScopeFromConfig } from "@/modules/knowledge/scan-scope";
import { getPlanScope } from "@/modules/billing/plan-scope-store";
import { copyForPlatform } from "@/modules/platforms/copy";
import { prisma } from "@/lib/prisma";
import type { CrawlItem, SiteUnderstanding } from "@/modules/knowledge/types";
import { cn, formatNumber } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const [data, testingMode, entitlements] = await Promise.all([
    getDashboardOverview(session),
    isPlatformReviewMode(session.platform),
    entitlementsForOrganization(session.organizationId),
  ]);
  const [planScope, scanSource] = await Promise.all([
    getPlanScope(entitlements.planKey),
    prisma.knowledgeSource.findFirst({
      where: { organizationId: session.organizationId, siteId: session.siteId, type: "site-scan" },
      select: { metadata: true, lastSyncedAt: true },
    }),
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
  const platformName = platformLabel(session.platform);
  const scope = scanScopeFromConfig(entitlements.planKey, planScope);
  const { crawl, brand } = parseScanSourceMeta(scanSource?.metadata);
  const understanding =
    data.profile?.structured && typeof data.profile.structured === "object"
      ? (data.profile.structured as unknown as SiteUnderstanding)
      : null;

  const snapshot = scanSnapshotFromStore({
    planKey: entitlements.planKey,
    planLabel: planLabel(entitlements.planKey),
    scopeNote: copyForPlatform(session.platform, scope.depthNote),
    siteUrl: data.site.url,
    understanding,
    crawl: crawl as CrawlItem[],
    brand,
    counts: {
      pages: data.knowledge.pages,
      products: data.knowledge.products,
      faqs: data.knowledge.faqs,
      policies: data.knowledge.policies,
    },
    analyzedAt: scanSource?.lastSyncedAt?.toISOString() ?? data.knowledge.lastSyncedAt?.toISOString() ?? null,
  });

  return (
    <div className="space-y-5">
      <div className="workspace-hero relative overflow-hidden border border-white/10 bg-gradient-to-br from-navy-850 via-navy-900 to-navy-950 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />
        <PageHeader
          eyebrow={`${platformName} · ${siteName}`}
          title={data.agent?.name ?? "Your AI employee"}
          description={
            understanding?.summary
              ? understanding.summary.length > 140
                ? `${understanding.summary.slice(0, 137)}…`
                : understanding.summary
              : "Answers stay evidence-based from your site knowledge."
          }
          actions={
            <>
              <StatusPill status={data.agent?.status ?? "DRAFT"} />
              <Link href="/knowledge" className="btn-secondary px-3 py-1.5 text-xs">
                Knowledge
              </Link>
              <Link href="/agent" className="btn-secondary px-3 py-1.5 text-xs">
                Agent
              </Link>
              {testingMode ? (
                <a href="#test-ai" className="btn-primary px-3 py-1.5 text-xs">
                  Test AI
                </a>
              ) : null}
            </>
          }
        />

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Conversations" value={formatNumber(data.metrics.conversations)} />
          <Stat label="Resolved by AI" value={formatNumber(data.metrics.resolvedByAi)} />
          <Stat label="Escalations" value={formatNumber(data.metrics.humanEscalations)} />
          <Stat label="Coverage" value={`${data.metrics.knowledgeCoverage}%`} accent />
        </div>
      </div>

      {widgetNotice?.error ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-navy-200">
          Widget not applied on {widgetHost} ({widgetNotice.error}). Reopen the app after confirming permissions.
        </p>
      ) : null}

      {snapshot ? (
        <section className="panel overflow-hidden p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg text-white">Site knowledge</h2>
              <p className="text-xs text-navy-400">
                {understanding?.name
                  ? `${understanding.name}${understanding.industry ? ` · ${understanding.industry}` : ""}`
                  : "From your live site"}
              </p>
            </div>
            <Link href="/knowledge" className="text-xs font-medium text-amber-300 hover:text-amber-200">
              Manage →
            </Link>
          </div>
          <KnowledgeCollectionBoard
            result={snapshot}
            siteUrl={data.site.url}
            platform={session.platform}
            compact
          />
        </section>
      ) : (
        <section className="panel flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 className="font-display text-lg text-white">Site knowledge</h2>
            <p className="mt-1 text-sm text-navy-300">Scan your site to teach the AI.</p>
          </div>
          <Link href="/knowledge" className="btn-primary">
            Teach AI
          </Link>
        </section>
      )}

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
            humanName={data.organization.humanAgentName}
          />
        </div>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg text-white">Top questions</h2>
            <Link href="/conversations" className="text-xs text-navy-400 hover:text-amber-300">
              Inbox
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.topQuestions.length ? (
              data.topQuestions.slice(0, 4).map((item, index) => (
                <div
                  key={item.topic}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-navy-950/35 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {index + 1}. {item.topic}
                    </p>
                    <p className="truncate text-xs text-navy-400">{item.question}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                    {item.occurrences}×
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-navy-400">Live visitor questions will appear here.</p>
            )}
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <h2 className="font-display text-lg text-white">AI health</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <HealthCell label="Unanswered" value={String(data.metrics.unanswered)} />
            <HealthCell label="Suggestions" value={String(data.metrics.improvementSuggestions)} />
            <HealthCell label="Leads" value={formatNumber(data.metrics.leads)} />
            <HealthCell label="Plan" value={planLabel(data.entitlements.planKey)} />
          </dl>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-navy-950/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-400">{label}</p>
      <p className={cn("mt-1 font-display text-xl tabular-nums sm:text-2xl", accent ? "text-amber-300" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function HealthCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-navy-950/35 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-navy-400">{label}</dt>
      <dd className="mt-1 font-medium text-white">{value}</dd>
    </div>
  );
}
