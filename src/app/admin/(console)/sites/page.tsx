import Link from "next/link";
import { listManagedSites } from "@/modules/admin/reporting";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { isSitePlatform, platformLabel, type SitePlatform } from "@/modules/platforms/types";

const FILTERS: Array<{ id: "ALL" | SitePlatform; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "WIX", label: "Wix" },
  { id: "WEBFLOW", label: "Webflow" },
  { id: "SHOPIFY", label: "Shopify" },
];

export default async function AdminSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const params = await searchParams;
  const selected = isSitePlatform(params.platform) ? params.platform : "ALL";
  const sites = await listManagedSites();
  const counts = {
    ALL: sites.length,
    WIX: sites.filter((site) => site.platform === "WIX" || !site.platform).length,
    WEBFLOW: sites.filter((site) => site.platform === "WEBFLOW").length,
    SHOPIFY: sites.filter((site) => site.platform === "SHOPIFY").length,
  };
  const visible =
    selected === "ALL"
      ? sites
      : sites.filter((site) => (selected === "WIX" ? site.platform === "WIX" || !site.platform : site.platform === selected));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access"
        title="Websites"
        description="Every connected site is a tenant. Filter by marketplace, then suspend access, inspect billing, or open the owner workspace."
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = selected === filter.id;
          const href = filter.id === "ALL" ? "/admin/sites" : `/admin/sites?platform=${filter.id}`;
          return (
            <Link
              key={filter.id}
              href={href}
              className={active ? "btn-primary" : "btn-secondary"}
            >
              {filter.label} ({counts[filter.id]})
            </Link>
          );
        })}
      </div>
      <div className="panel overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-navy-400">
            <tr>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Connection</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-navy-300" colSpan={6}>
                  No {selected === "ALL" ? "" : `${platformLabel(selected)} `}sites yet.
                </td>
              </tr>
            ) : (
              visible.map((site) => (
                <tr key={site.id} className="hover:bg-white/5">
                  <td className="px-4 py-4">
                    <Link href={`/admin/sites/${site.id}`} className="font-medium text-white hover:text-amber-300">
                      {site.displayName}
                    </Link>
                    <p className="text-xs text-navy-400">{site.ownerEmail || site.url || site.wixInstanceId}</p>
                  </td>
                  <td className="px-4 py-4">{platformLabel(site.platform)}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
