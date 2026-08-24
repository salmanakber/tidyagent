import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Landing } from "@/components/marketing/Landing";
import { getSession } from "@/lib/security/session";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { isWebflowOpenRequest, webflowCallbackQuery } from "@/modules/webflow/open";
import { shopifyAppQuery } from "@/modules/shopify/open";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    instance?: string;
    siteId?: string;
    site?: string;
    code?: string;
    state?: string;
    error?: string;
    shop?: string;
    hmac?: string;
    host?: string;
    timestamp?: string;
    session?: string;
    embedded?: string;
  }>;
}) {
  const params = await searchParams;
  if (params.instance) {
    redirect(`/wix/open?instance=${encodeURIComponent(params.instance)}`);
  }
  if (params.code || params.error) {
    redirect(
      webflowCallbackQuery({
        code: params.code,
        state: params.state,
        siteId: params.siteId,
        site: params.site,
        error: params.error,
      }),
    );
  }
  if (params.shop) {
    redirect(
      shopifyAppQuery({
        shop: params.shop,
        hmac: params.hmac,
        host: params.host,
        timestamp: params.timestamp,
        session: params.session,
        embedded: params.embedded,
      }),
    );
  }

  const session = await getSession();
  if (session) {
    redirect(await workspacePathForOrganization(session.organizationId));
  }

  const referer = (await headers()).get("referer");
  if (isWebflowOpenRequest({ referer, siteId: params.siteId, site: params.site })) {
    redirect("/webflow");
  }

  return <Landing />;
}
