import { getSetting, settingExists } from "@/lib/security/settings";
import { getAppOrigin } from "@/lib/env";

export type MarketplaceAdapterConfig = {
  origin: string;
  webflow: {
    enabled: boolean;
    clientId: string;
    clientSecretSet: boolean;
    redirectUri: string;
    installPath: string;
  };
  shopify: {
    enabled: boolean;
    apiKey: string;
    apiSecretSet: boolean;
    redirectUri: string;
    installPath: string;
  };
  widgetSrc: string;
};

function truthyFlag(value: string) {
  return value === "true" || value === "1" || value === "on";
}

/** Admin Settings are the source of truth. .env is only a fallback. */
export async function getMarketplaceAdapterConfig(): Promise<MarketplaceAdapterConfig> {
  const origin = getAppOrigin();
  const [
    webflowEnabled,
    webflowClientId,
    webflowSecretSet,
    shopifyEnabled,
    shopifyApiKey,
    shopifySecretSet,
  ] = await Promise.all([
    getSetting("webflow_enabled", process.env.WEBFLOW_ENABLED ?? "false"),
    getSetting("webflow_client_id"),
    settingExists("webflow_client_secret"),
    getSetting("shopify_enabled", process.env.SHOPIFY_ENABLED ?? "false"),
    getSetting("shopify_api_key"),
    settingExists("shopify_api_secret"),
  ]);

  return {
    origin,
    webflow: {
      enabled: truthyFlag(webflowEnabled),
      clientId: webflowClientId,
      clientSecretSet: webflowSecretSet,
      redirectUri: `${origin}/api/webflow/oauth/callback`,
      installPath: `${origin}/webflow/install`,
    },
    shopify: {
      enabled: truthyFlag(shopifyEnabled),
      apiKey: shopifyApiKey,
      apiSecretSet: shopifySecretSet,
      redirectUri: `${origin}/api/shopify/oauth/callback`,
      installPath: `${origin}/shopify/install`,
    },
    widgetSrc: `${origin}/widget.js`,
  };
}

export async function isWebflowAdapterEnabled() {
  const config = await getMarketplaceAdapterConfig();
  return config.webflow.enabled;
}

export async function isShopifyAdapterEnabled() {
  const config = await getMarketplaceAdapterConfig();
  return config.shopify.enabled;
}
