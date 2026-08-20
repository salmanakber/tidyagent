import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddKnowledgeForm } from "@/components/knowledge/AddKnowledgeForm";
import { SiteScanPanel } from "@/components/knowledge/SiteScanPanel";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { planLabel } from "@/modules/billing/catalog";
import { scanScopeFromConfig } from "@/modules/knowledge/scan-scope";
import { getPlanScope } from "@/modules/billing/plan-scope-store";
import { knowledgeCardsForSite, siteFactsFromApps } from "@/modules/knowledge/site-facts";

export const maxDuration = 120;

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);
  const entitlements = await entitlementsForOrganization(session.organizationId);
  const planScope = await getPlanScope(entitlements.planKey);
  const scope = scanScopeFromConfig(entitlements.planKey, planScope);

  const facts = siteFactsFromApps(data.site.installedWixApps);
  const cards = knowledgeCardsForSite({
    hasStores: facts.hasStores,
    hasBookings: facts.hasBookings,
    pages: data.knowledge.pages,
    products: data.knowledge.products,
    faqs: data.knowledge.faqs,
    policies: data.knowledge.policies,
    custom: data.knowledge.custom,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Business knowledge"
        title="What your AI employee knows"
        description="The scanner reads the live Wix site in this plan’s scope. Custom notes you add sit above that and are never overwritten."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="panel p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">{card.label}</p>
            <p className="mt-3 font-display text-3xl text-white">{card.value}</p>
            <p className="mt-1 text-xs text-navy-400">{card.hint}</p>
          </div>
        ))}
      </div>
      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Website scanner</h2>
        <p className="mt-2 text-sm text-navy-300">
          Re-run this after you change pages, policies, or products. Last sync:{" "}
          {data.knowledge.lastSyncedAt ? new Date(data.knowledge.lastSyncedAt).toLocaleString() : "not yet"}
        </p>
        {data.profile?.summary ? (
          <p className="mt-4 rounded-2xl bg-navy-950/40 p-4 text-sm leading-6 text-navy-100">{data.profile.summary}</p>
        ) : null}
        <div className="mt-6">
          <SiteScanPanel
            planLabel={planLabel(entitlements.planKey)}
            scopeNote={scope.depthNote}
            siteUrl={data.site.url}
          />
        </div>
      </div>
      <AddKnowledgeForm lastSynced={data.knowledge.lastSyncedAt?.toISOString() ?? null} />
    </div>
  );
}
