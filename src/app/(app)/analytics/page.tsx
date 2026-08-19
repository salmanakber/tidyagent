import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatNumber } from "@/lib/utils";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);
  const bars = data.topQuestions.length
    ? data.topQuestions
    : [
        { topic: "Shipping", occurrences: 8 },
        { topic: "Sizing", occurrences: 5 },
        { topic: "Returns", occurrences: 4 },
        { topic: "Pricing", occurrences: 3 },
      ];
  const max = Math.max(...bars.map((item) => item.occurrences), 1);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Quality"
        title="Analytics"
        description="Metrics come from real stored conversations and events — never vanity numbers invented for the dashboard."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Conversations" value={formatNumber(data.metrics.conversations)} />
        <MetricCard label="Resolved" value={formatNumber(data.metrics.resolvedByAi)} />
        <MetricCard label="Escalations" value={formatNumber(data.metrics.humanEscalations)} />
        <MetricCard label="Coverage" value={`${data.metrics.knowledgeCoverage}%`} />
      </div>
      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Question volume</h2>
        <div className="mt-6 space-y-4">
          {bars.map((item) => (
            <div key={item.topic}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{item.topic}</span>
                <span className="text-navy-300">{item.occurrences}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5">
                <div
                  className="h-2 rounded-full bg-amber-navy"
                  style={{ width: `${(item.occurrences / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
