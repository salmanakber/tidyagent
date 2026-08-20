import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);
  const topicMax = Math.max(...data.charts.topics.map((item) => item.occurrences), 1);
  const dayMax = Math.max(...data.charts.daily.map((item) => item.conversations), 1);
  const agentMax = Math.max(...data.charts.byAgent.map((item) => item.replies), 1);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Quality"
        title="Analytics"
        description="Numbers come from live chats, knowledge, and leads on this Wix site. Empty charts mean visitors have not talked yet."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Conversations" value={formatNumber(data.metrics.conversations)} hint="All time" />
        <MetricCard label="Resolved by AI" value={formatNumber(data.metrics.resolvedByAi)} />
        <MetricCard label="Human escalations" value={formatNumber(data.metrics.humanEscalations)} />
        <MetricCard label="Leads" value={formatNumber(data.metrics.leads)} hint="Visitors who left an email" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visitor messages" value={formatNumber(data.metrics.visitorMessages)} hint="Last 30 days" />
        <MetricCard label="Unanswered" value={formatNumber(data.metrics.unanswered)} />
        <MetricCard label="Knowledge coverage" value={`${data.metrics.knowledgeCoverage}%`} hint="Types of site data we have" />
        <MetricCard label="Product questions" value={formatNumber(data.metrics.salesAssisted)} hint="Last 30 days" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Conversations · 14 days</h2>
          {data.charts.daily.every((item) => item.conversations === 0) ? (
            <p className="mt-6 text-sm text-navy-300">No chats in the last two weeks yet.</p>
          ) : (
            <div className="mt-6 flex h-40 items-end gap-1.5">
              {data.charts.daily.map((item) => (
                <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full items-end rounded-t-lg bg-white/5">
                    <div
                      className="w-full rounded-t-lg bg-amber-500/80"
                      style={{ height: `${Math.max(6, (item.conversations / dayMax) * 100)}%` }}
                      title={`${item.conversations} on ${item.date}`}
                    />
                  </div>
                  <span className="text-[10px] text-navy-400">{item.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">What visitors ask</h2>
          {data.charts.topics.length ? (
            <div className="mt-6 space-y-4">
              {data.charts.topics.map((item) => (
                <div key={item.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-white">{item.label}</span>
                    <span className="text-navy-300">{item.occurrences}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-amber-navy"
                      style={{ width: `${(item.occurrences / topicMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-navy-300">Topics appear after visitors ask more than a greeting.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Needs knowledge</h2>
          <p className="mt-1 text-sm text-navy-300">Questions the AI could not answer from the site. Scan more pages or add notes.</p>
          <div className="mt-5 space-y-3">
            {data.improvements.length ? (
              data.improvements.map((item) => (
                <div key={item.id} className="rounded-2xl bg-navy-950/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white">{item.topic}</p>
                    <span className="text-xs text-amber-300">{item.occurrences}×</span>
                  </div>
                  <p className="mt-1 text-xs text-navy-300">{item.question}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-navy-300">No unanswered questions logged yet.</p>
            )}
          </div>
          <Link href="/knowledge" className="btn-secondary mt-5">
            Open knowledge
          </Link>
        </div>

        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Replies by agent</h2>
          {data.charts.byAgent.length ? (
            <div className="mt-6 space-y-4">
              {data.charts.byAgent.map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-white">{item.name}</span>
                    <span className="text-navy-300">{item.replies}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-amber-500/70"
                      style={{ width: `${agentMax ? (item.replies / agentMax) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-navy-300">Agent mix shows once the widget is answering.</p>
          )}
        </div>
      </div>
    </div>
  );
}
