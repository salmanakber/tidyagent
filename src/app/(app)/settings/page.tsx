import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { logout } from "@/app/actions/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { planLabel } from "@/modules/billing/catalog";
import { legalHref } from "@/modules/legal/platform";
import { isWixPlatform, isShopifyPlatform, isWebflowPlatform, platformLabel, resolveSitePlatform } from "@/modules/platforms";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);
  const wix = isWixPlatform(session.platform);
  const name = platformLabel(session.platform);
  const platform = resolveSitePlatform(session.platform);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description={
          wix
            ? "Wix is the source of truth for install and billing. Widget look is your brand, not tidyAgent’s."
            : isShopifyPlatform(session.platform)
              ? "Shopify is the source of truth for install and billing. Widget look is your brand, not tidyAgent’s."
              : "Webflow is the source of truth for this install. Widget look is your brand, not tidyAgent’s."
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">
            {wix ? "Wix connection" : isShopifyPlatform(session.platform) ? "Shopify connection" : "Webflow connection"}
          </h2>
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
          <form action={logout} className="mt-6">
            <button className="btn-secondary">Disconnect this site</button>
          </form>
          <p className="mt-3 text-xs leading-5 text-navy-400">
            {wix
              ? "Clears this browser session. Reopen tidyAgent from Wix, or use Reconnect with Wix on the sign-in page, to authenticate again."
              : isShopifyPlatform(session.platform)
                ? "Clears this browser session. Reopen tidyAgent from Shopify Admin to authenticate again."
                : isWebflowPlatform(session.platform)
                  ? "Clears this browser session and removes tidyAgent’s Webflow Custom Code widget (other scripts are left alone). Reopen from Webflow to connect again, then publish if the live bubble should disappear."
                  : `Clears this browser session for this ${name} site.`}
          </p>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Subscription (server-side)</h2>
          <p className="mt-2 text-sm text-navy-300">
            Frontend plan badges are never trusted. Entitlements are enforced on the backend.
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Plan" value={planLabel(data.entitlements.planKey)} />
            <Row label="Conversations" value={String(data.entitlements.conversationLimit)} />
            <Row label="Knowledge" value={String(data.entitlements.knowledgeLimit)} />
            <Row label="Agents" value={String(data.entitlements.maxAgents)} />
            <Row label="Voice" value={data.entitlements.voiceEnabled ? "On" : "Off"} />
          </dl>
          <p className="mt-6 text-xs leading-5 text-navy-400">
            <a
              href={
                platform === "WEBFLOW"
                  ? "/docs/webflow"
                  : platform === "SHOPIFY"
                    ? "/install/shopify"
                    : "/install"
              }
              className="text-amber-300 hover:underline"
            >
              {platform === "WEBFLOW" ? "Webflow guide" : "Install guide"}
            </a>
            {" · "}
            <a href={legalHref("/terms", platform)} className="text-amber-300 hover:underline">
              Terms of Use
            </a>
            {" · "}
            <a href={legalHref("/privacy", platform)} className="text-amber-300 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
      {data.agent ? (
        <p className="text-sm text-navy-300">
          Widget appearance lives in{" "}
          <a href="/agent" className="text-amber-300">
            AI Agent
          </a>
          . Voice is {data.entitlements.voiceEnabled ? "included on this plan" : "not included on this plan"}.
        </p>
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
