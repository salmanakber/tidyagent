import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { isWebflowAdapterEnabled } from "@/modules/platforms/marketplace";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { ensureWebflowWidgetForSite } from "@/modules/webflow/embed";
import { isEmbeddedWebflowRequest, webflowCallbackQuery } from "@/modules/webflow/open";
import { WebflowConnect } from "./WebflowConnect";

export const dynamic = "force-dynamic";

export default async function WebflowAppHome({
  searchParams,
}: {
  searchParams: Promise<{
    embed?: string;
    siteId?: string;
    site?: string;
    code?: string;
    state?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
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
  const session = await getSession();
  if (session) {
    await ensureWebflowWidgetForSite(session.siteId).catch((error) => {
      console.error("Webflow widget inject on open failed", error);
    });
    redirect(await workspacePathForOrganization(session.organizationId));
  }

  if (!(await isWebflowAdapterEnabled())) {
    redirect("/webflow/missing?error=disabled");
  }

  const siteId = params.siteId || params.site || "";
  const headerList = await headers();
  const framed = isEmbeddedWebflowRequest({
    embed: params.embed,
    dest: headerList.get("sec-fetch-dest"),
    site: headerList.get("sec-fetch-site"),
    referer: headerList.get("referer"),
  });
  const install = `/webflow/install${qs({ embed: framed ? "1" : "", siteId })}`;

  if (framed) {
    return <WebflowConnect installHref={install} />;
  }

  redirect(install);
}

function qs(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
