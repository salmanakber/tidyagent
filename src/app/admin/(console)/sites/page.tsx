import Link from "next/link";
import { listManagedSites } from "@/modules/admin/reporting";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";

export default async function AdminSitesPage() {
  const sites = await listManagedSites();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access"
        title="Websites"
        description="Every Wix install is a tenant. Suspend access, inspect billing, or open the owner workspace without mixing tenant data."
      />
      <div className="panel overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-navy-400">
            <tr>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Wix</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sites.map((site) => (
              <tr key={site.id} className="hover:bg-white/5">
                <td className="px-4 py-4">
                  <Link href={`/admin/sites/${site.id}`} className="font-medium text-white hover:text-amber-300">
                    {site.displayName}
                  </Link>
                  <p className="text-xs text-navy-400">{site.ownerEmail || site.url || site.wixInstanceId}</p>
                </td>
                <td className="px-4 py-4">{site.platform === "WEBFLOW" ? "Webflow" : site.platform === "SHOPIFY" ? "Shopify" : "Wix"}</td>
                <td className="px-4 py-4">
                  {site.isFree ? "FREE" : site.planKey}
                  {site.compPlanKey ? (
                    <span className="ml-2 text-xs text-amber-300">comp {site.compPlanKey}</span>
                  ) : null}
                  {site.cancelAtPeriodEnd && !site.compPlanKey ? (
                    <span className="ml-2 text-xs text-amber-300">ends soon</span>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <StatusPill status={site.connectionStatus} />
                </td>
                <td className="px-4 py-4">
                  <StatusPill status={site.accessStatus} />
                </td>
                <td className="px-4 py-4 text-navy-300">
                  {site.conversations} chats · {site.knowledge} docs
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
