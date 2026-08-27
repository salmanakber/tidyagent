import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/settings";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { isShopifyPlatform } from "@/modules/platforms/types";
import { ShopifyApiError } from "@/modules/shopify/client";
import { normalizeShopifyShop } from "@/modules/shopify/shop";

const REFRESH_SKEW_MS = 5 * 60 * 1000;

export type ShopifyTokenBundle = {
  accessToken: string;
  refreshToken?: string | null;
  scope: string;
  expiresAt?: string | null;
  refreshExpiresAt?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function isNonExpiringTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /non-expiring access tokens are no longer accepted/i.test(message);
}

export function merchantShopifyError(error: unknown) {
  if (isNonExpiringTokenError(error)) {
    return "Shopify needs you to reopen tidyAgent once so we can refresh the store connection.";
  }
  if (error instanceof ShopifyApiError && error.status === 403) {
    return "Shopify blocked this action. Reopen tidyAgent from Shopify Admin to refresh permissions.";
  }
  if (error instanceof ShopifyApiError && error.status === 401) {
    return "The Shopify connection expired. Reopen tidyAgent from Shopify Admin.";
  }
  return "We could not update the storefront chat widget. Reopen tidyAgent from Shopify Admin and try again.";
}

export async function exchangeShopifyCode(input: {
  shop: string;
  apiKey: string;
  apiSecret: string;
  code: string;
}): Promise<ShopifyTokenBundle> {
  const response = await fetch(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: input.apiKey,
      client_secret: input.apiSecret,
      code: input.code,
      // Required for new public apps — non-expiring offline tokens are rejected by Admin API.
      expiring: 1,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new ShopifyApiError(
      body.error_description || body.error || `Shopify token exchange failed (${response.status})`,
      response.status,
    );
  }
  return bundleFromResponse(body);
}

export async function refreshShopifyOfflineToken(input: {
  shop: string;
  apiKey: string;
  apiSecret: string;
  refreshToken: string;
}): Promise<ShopifyTokenBundle> {
  const response = await fetch(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: input.apiKey,
      client_secret: input.apiSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new ShopifyApiError(
      body.error_description || body.error || `Shopify token refresh failed (${response.status})`,
      response.status,
    );
  }
  return bundleFromResponse(body);
}

function bundleFromResponse(body: {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}): ShopifyTokenBundle {
  const now = Date.now();
  return {
    accessToken: String(body.access_token),
    refreshToken: body.refresh_token || null,
    scope: body.scope ?? "",
    expiresAt:
      typeof body.expires_in === "number" ? new Date(now + body.expires_in * 1000).toISOString() : null,
    refreshExpiresAt:
      typeof body.refresh_token_expires_in === "number"
        ? new Date(now + body.refresh_token_expires_in * 1000).toISOString()
        : null,
  };
}

export function tokenMetadataFields(input: {
  shop: string;
  tokens: ShopifyTokenBundle;
  previous?: Record<string, unknown>;
}) {
  const previous = input.previous ?? {};
  return {
    ...previous,
    provider: "shopify",
    accessToken: encryptSecret(input.tokens.accessToken),
    refreshToken: input.tokens.refreshToken ? encryptSecret(input.tokens.refreshToken) : null,
    scope: input.tokens.scope || String(previous.scope ?? ""),
    shopifyShopDomain: input.shop,
    accessTokenExpiresAt: input.tokens.expiresAt ?? null,
    refreshTokenExpiresAt: input.tokens.refreshExpiresAt ?? null,
    tokenType: input.tokens.refreshToken || input.tokens.expiresAt ? "expiring_offline" : "offline",
  };
}

/**
 * Returns a usable Admin API access token, refreshing when the offline token is near expiry.
 */
export async function getValidShopifyAccessToken(siteId: string): Promise<{
  shop: string;
  accessToken: string;
  scope: string;
} | null> {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isShopifyPlatform(site.platform) || !site.shopifyShopDomain) return null;

  const shop = normalizeShopifyShop(site.shopifyShopDomain) || site.shopifyShopDomain;
  const metadata = asRecord(site.credential?.metadata);
  let accessToken = decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) return null;

  const expiresAt = typeof metadata.accessTokenExpiresAt === "string" ? Date.parse(metadata.accessTokenExpiresAt) : NaN;
  const refreshToken = decryptSecret(String(metadata.refreshToken ?? ""));
  const needsRefresh =
    Boolean(refreshToken) && (!Number.isFinite(expiresAt) || expiresAt - Date.now() <= REFRESH_SKEW_MS);

  if (needsRefresh && refreshToken) {
    const config = await getShopifyOAuthConfig();
    if (config.apiKey && config.apiSecret) {
      try {
        const tokens = await refreshShopifyOfflineToken({
          shop,
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          refreshToken,
        });
        await prisma.wixCredential.updateMany({
          where: { siteId },
          data: { metadata: tokenMetadataFields({ shop, tokens, previous: metadata }) },
        });
        accessToken = tokens.accessToken;
        return { shop, accessToken, scope: tokens.scope || String(metadata.scope ?? "") };
      } catch (error) {
        console.error("Shopify token refresh failed", error);
      }
    }
  }

  return { shop, accessToken, scope: String(metadata.scope ?? "") };
}
