import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAppOrigin } from "@/lib/env";
import { getSession } from "@/lib/security/session";
import { isShopifyAdapterEnabled, getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { ensureShopifyWidgetForSite } from "@/modules/shopify/embed";
import { verifyShopifyQueryHmac } from "@/modules/shopify/hmac";
import { shopifyCallbackQuery } from "@/modules/shopify/open";
import { normalizeShopifyShop } from "@/modules/shopify/shop";
import { ShopifyConnect } from "./ShopifyConnect";

export const dynamic = "force-dynamic";

export default async function ShopifyAppHome({
  searchParams,
}: {
  searchParams: Promise<{
    shop?: string;
    hmac?: string;
    host?: string;
    timestamp?: string;
    session?: string;
    embedded?: string;
    embed?: string;
    code?: string;
    state?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  if (params.code || params.error) {
    redirect(
      shopifyCallbackQuery({
        shop: params.shop,
        hmac: params.hmac,
        host: params.host,
        timestamp: params.timestamp,
        code: params.code,
        state: params.state,
        error: params.error,
      }),
    );
  }

  const session = await getSession();
  if (session) {
    await ensureShopifyWidgetForSite(session.siteId).catch((error) => {
      console.error("Shopify widget inject on open failed", error);
    });
    redirect(await workspacePathForOrganization(session.organizationId));
  }

  if (!(await isShopifyAdapterEnabled())) {
    redirect("/shopify/missing?error=disabled");
  }

  const shop = normalizeShopifyShop(params.shop) ?? "";
  if (params.hmac) {
    const config = await getShopifyOAuthConfig();
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) search.set(key, value);
    }
    if (!verifyShopifyQueryHmac(search, config.apiSecret)) {
      redirect("/shopify/missing?error=invalid_hmac");
    }
  }
  const framed =
    (await headers()).get("sec-fetch-dest") === "iframe" ||
    params.embedded === "1" ||
    params.embed === "1" ||
    Boolean(params.host);

  if (!shop) {
    redirect("/shopify/missing?error=no_shop");
  }

  const origin = getAppOrigin();
  const installPath = `/shopify/install?shop=${encodeURIComponent(shop)}${framed ? "&embed=1" : ""}`;
  const installAbsolute = new URL(installPath, origin).toString();

  // Inside Shopify Admin iframe: break out with target=_top (login pages refuse iframes).
  if (framed) {
    return <ShopifyConnect installHref={installAbsolute} />;
  }

  redirect(installPath);
}
