import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Landing } from "@/components/marketing/Landing";
import { getSession } from "@/lib/security/session";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { isWebflowOpenRequest } from "@/modules/webflow/open";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ instance?: string; siteId?: string; site?: string }>;
}) {
  const params = await searchParams;
  if (params.instance) {
    redirect(`/wix/open?instance=${encodeURIComponent(params.instance)}`);
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
