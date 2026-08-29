import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { isShopifyAdapterEnabled, getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { ensureShopifyWidgetForSite } from "@/modules/shopify/embed";
import { verifyShopifyQueryHmac } from "@/modules/shopify/hmac";
import { shopifyCallbackQuery } from "@/modules/shopify/open";
import { normalizeShopifyShop } from "@/modules/shopify/shop";
import { ShopifyEmbeddedAuth } from "./ShopifyEmbeddedAuth";

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
    id_token?: string;
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

  if (!(await isShopifyAdapterEnabled())) {
    redirect("/shopify/missing?error=disabled");
  }

  const shop = normalizeShopifyShop(params.shop) ?? "";
  const config = await getShopifyOAuthConfig();
  if (params.hmac) {
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

  // Embedded Admin: always run session-token exchange (even if a tidyAgent cookie exists).
  // Skipping this left expired offline tokens in the DB and broke knowledge scans with 401.
  if (framed) {
    if (!config.apiKey) {
      redirect("/shopify/missing?error=not_configured");
    }
    return (
      <ShopifyEmbeddedAuth
        apiKey={config.apiKey}
        host={params.host || ""}
        shop={shop}
        bootstrapIdToken={params.id_token || ""}
      />
    );
  }

  const session = await getSession();
  if (session) {
    await ensureShopifyWidgetForSite(session.siteId).catch((error) => {
      console.error("Shopify widget inject on open failed", error);
    });
    redirect(await workspacePathForOrganization(session.organizationId));
  }

  // Standalone / top-level install (not inside Shopify Admin iframe).
  redirect(`/shopify/install?shop=${encodeURIComponent(shop)}`);
}
