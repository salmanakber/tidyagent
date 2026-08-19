import { getPlatformReports } from "@/modules/admin/reporting";
import { PageHeader } from "@/components/ui/PageHeader";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";

export default async function AdminReportsPage() {
  const data = await getPlatformReports();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reporting"
        title="Platform reports"
        description="Cross-tenant quality and usage. Individual customer conversations stay in their own workspace."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Sites near conversation limits</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {data.approachingLimit.length === 0 ? (
              <li className="text-navy-300">No sites above 70% of their plan cap.</li>
            ) : (
              data.approachingLimit.map((site) => (
                <li key={site.id} className="flex justify-between gap-3">
                  <Link href={`/admin/sites/${site.id}`} className="text-white hover:text-amber-300">
                    {site.displayName}
                  </Link>
                  <span className="text-navy-300">
                    {site.conversations} · {site.planKey}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Knowledge gaps</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {data.improvements.length === 0 ? (
              <li className="text-navy-300">No open improvement suggestions.</li>
            ) : (
              data.improvements.map((item) => (
                <li key={item.id}>
                  <p className="text-white">{item.topic}</p>
                  <p className="text-xs text-navy-400">
                    {item.organization.name} · {item.occurrences}×
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className="panel p-6">
        <h2 className="font-display text-xl text-white">Operator audit</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {data.audit.length === 0 ? (
            <li className="text-navy-300">No admin actions yet.</li>
          ) : (
            data.audit.map((row) => (
              <li key={row.id} className="flex justify-between gap-3">
                <span>
                  {row.adminEmail} · {row.action}
                </span>
                <span className="text-navy-400">{relativeTime(row.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
