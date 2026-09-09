import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { isPlatformReviewMode } from "@/modules/auth/reviewer";
import { platformLabel, isWebflowPlatform, isShopifyPlatform, isWixPlatform } from "@/modules/platforms";
import { webflowWidgetStatus } from "@/modules/webflow/embed";
import { shopifyWidgetStatus } from "@/modules/shopify/embed";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
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
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, MessageSquare, Sparkles } from "lucide-react";

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
    <div className="space-y-8">
      <div className="workspace-hero relative overflow-hidden border border-white/10 bg-gradient-to-br from-navy-850 via-navy-900 to-navy-950 p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
        <PageHeader
          eyebrow={`${platformName} workspace`}
          title={data.agent?.name ?? "Your AI employee"}
          description={`${siteName} is connected. Answers stay evidence-based. Sensitive actions stay behind confirmation.`}
          actions={
            <>
              <StatusPill status={data.agent?.status ?? "DRAFT"} />
              <Link href="/knowledge" className="btn-secondary">
                Knowledge
              </Link>
              <Link href="/agent" className="btn-secondary">
                Agent
              </Link>
              {testingMode ? (
                <a href="#test-ai" className="btn-primary">
                  Test AI
                </a>
              ) : null}
            </>
          }
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <QuickLink href="/conversations" icon={<MessageSquare className="h-4 w-4" />} label="Inbox" hint="Live visitor chats" />
          <QuickLink
            href="/knowledge"
            icon={<BookOpen className="h-4 w-4" />}
            label="Train knowledge"
            hint={
              isWebflowPlatform(session.platform)
                ? "Webflow APIs + manual notes"
                : isShopifyPlatform(session.platform)
                  ? "Shopify catalog + manual notes"
                  : "Site scan + owner notes"
            }
          />
          <QuickLink href="/agent" icon={<Sparkles className="h-4 w-4" />} label="Agent style" hint="Voice, color, greeting" />
        </div>
      </div>

      {widgetNotice ? (
        <div className="border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm leading-6 text-navy-100">
          {widgetNotice.error ? (
            <>
              The chat widget was not applied on {widgetHost} ({widgetNotice.error}). Open the app again after confirming
              script / custom-code permission.
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

      {isWixPlatform(session.platform) && !widgetNotice ? (
        <div className="border border-white/10 bg-navy-900/50 px-4 py-3 text-sm text-navy-300">
          Connected through Wix. Keep scanning after site edits so answers stay current.
        </div>
      ) : null}

      {snapshot ? (
        <section className="panel p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-white">Site knowledge</h2>
              <p className="mt-1 text-sm text-navy-300">
                {understanding?.name ? `${understanding.name} · ${understanding.industry}` : "Collected from your live site"}
              </p>
            </div>
            <Link href="/knowledge" className="text-sm text-amber-300 hover:text-amber-200">
              Open knowledge →
            </Link>
          </div>
          {understanding?.summary ? (
            <p className="mb-5 border border-white/10 bg-navy-950/40 p-4 text-sm leading-6 text-navy-100">{understanding.summary}</p>
          ) : null}
          <KnowledgeCollectionBoard result={snapshot} siteUrl={data.site.url} platform={session.platform} />
        </section>
      ) : (
        <section className="panel p-5 sm:p-6">
          <h2 className="font-display text-xl text-white">Site knowledge</h2>
          <p className="mt-2 text-sm text-navy-300">Run a site scan from Knowledge to fill Pages, Colors, Images, and more.</p>
          <Link href="/knowledge" className="btn-primary mt-4 inline-flex">
            Teach AI from site
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Conversations" value={formatNumber(data.metrics.conversations)} hint="All conversations" />
        <MetricCard label="Resolved by AI" value={formatNumber(data.metrics.resolvedByAi)} />
        <MetricCard label="Human escalations" value={formatNumber(data.metrics.humanEscalations)} />
        <MetricCard label="Leads" value={formatNumber(data.metrics.leads)} hint={`${formatNumber(data.metrics.salesAssisted)} sales assisted`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-6">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl text-white">Top questions</h2>
            <span className="text-[11px] uppercase tracking-[0.16em] text-navy-400">Live signal</span>
          </div>
          <div className="mt-5 space-y-3">
            {data.topQuestions.length ? (
              data.topQuestions.map((item, index) => (
                <div
                  key={item.topic}
                  className="flex items-center justify-between border border-white/5 bg-navy-950/40 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-white">
                      {index + 1}. {item.topic}
                    </p>
                    <p className="text-xs text-navy-300">{item.question}</p>
                  </div>
                  <span className="bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">{item.occurrences}×</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-navy-300">Questions from live chats will show here after visitors start talking.</p>
            )}
          </div>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">AI health</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Knowledge coverage" value={`${data.metrics.knowledgeCoverage}%`} accent />
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

function QuickLink({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group border border-white/10 bg-navy-950/40 px-4 py-3 transition hover:border-amber-500/35 hover:bg-amber-500/5"
    >
      <div className="flex items-center gap-2 text-amber-300">
        {icon}
        <span className="text-sm font-medium text-white group-hover:text-amber-100">{label}</span>
      </div>
      <p className="mt-1 text-xs text-navy-400">{hint}</p>
    </Link>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between bg-navy-950/35 px-3 py-2.5">
      <dt className="text-navy-300">{label}</dt>
      <dd className={accent ? "font-medium text-amber-300" : "font-medium text-white"}>{value}</dd>
    </div>
  );
}
