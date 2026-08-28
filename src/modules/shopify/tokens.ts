import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/settings";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { isShopifyPlatform } from "@/modules/platforms/types";
import { shopifyGet, shopifyGraphql, ShopifyApiError } from "@/modules/shopify/client";
import { normalizeShopifyShop } from "@/modules/shopify/shop";

const REFRESH_SKEW_MS = 5 * 60 * 1000;

export type ShopifySiteCreds = {
  shop: string;
  accessToken: string;
  scope: string;
};

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

export function isShopifyAuthFailure(error: unknown) {
  if (!(error instanceof ShopifyApiError)) return false;
  if (error.status === 401) return true;
  if (error.status === 403 && isNonExpiringTokenError(error)) return true;
  return false;
}

function parseAccessTokenExpiry(metadata: Record<string, unknown>) {
  return typeof metadata.accessTokenExpiresAt === "string"
    ? Date.parse(metadata.accessTokenExpiresAt)
    : NaN;
}

function accessTokenNeedsRefresh(expiresAt: number) {
  return !Number.isFinite(expiresAt) || expiresAt - Date.now() <= REFRESH_SKEW_MS;
}

function accessTokenIsExpired(expiresAt: number) {
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
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
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
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

/**
 * Embedded Admin auth: exchange App Bridge ID token for an expiring offline access token.
 * This stays inside the Shopify iframe and cycles deprecated non-expiring tokens.
 */
export async function exchangeShopifySessionToken(input: {
  shop: string;
  apiKey: string;
  apiSecret: string;
  idToken: string;
}): Promise<ShopifyTokenBundle> {
  const response = await fetch(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: input.apiKey,
      client_secret: input.apiSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: input.idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      expiring: "1",
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
      body.error_description || body.error || `Shopify session token exchange failed (${response.status})`,
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

async function loadShopifySiteAuth(siteId: string) {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isShopifyPlatform(site.platform) || !site.shopifyShopDomain) return null;

  const shop = normalizeShopifyShop(site.shopifyShopDomain) || site.shopifyShopDomain;
  const metadata = asRecord(site.credential?.metadata);
  const accessToken = decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) return null;

  return {
    siteId,
    shop,
    metadata,
    accessToken,
    refreshToken: decryptSecret(String(metadata.refreshToken ?? "")),
    expiresAt: parseAccessTokenExpiry(metadata),
    scope: String(metadata.scope ?? ""),
  };
}

/**
 * Force-refresh an expiring offline token and persist it.
 */
export async function refreshShopifyAccessTokenForSite(siteId: string): Promise<ShopifySiteCreds | null> {
  const row = await loadShopifySiteAuth(siteId);
  if (!row?.refreshToken) return null;

  const config = await getShopifyOAuthConfig();
  if (!config.apiKey || !config.apiSecret) return null;

  try {
    const tokens = await refreshShopifyOfflineToken({
      shop: row.shop,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      refreshToken: row.refreshToken,
    });
    await prisma.wixCredential.updateMany({
      where: { siteId },
      data: { metadata: tokenMetadataFields({ shop: row.shop, tokens, previous: row.metadata }) },
    });
    return { shop: row.shop, accessToken: tokens.accessToken, scope: tokens.scope || row.scope };
  } catch (error) {
    console.error("Shopify token refresh failed", { siteId, shop: row.shop, error });
    return null;
  }
}

/**
 * Returns a usable Admin API access token, refreshing when the offline token is near expiry.
 */
export async function getValidShopifyAccessToken(
  siteId: string,
  options?: { forceRefresh?: boolean },
): Promise<ShopifySiteCreds | null> {
  const row = await loadShopifySiteAuth(siteId);
  if (!row) return null;

  const shouldRefresh =
    Boolean(options?.forceRefresh) ||
    (Boolean(row.refreshToken) && accessTokenNeedsRefresh(row.expiresAt));

  if (shouldRefresh && row.refreshToken) {
    const refreshed = await refreshShopifyAccessTokenForSite(siteId);
    if (refreshed) return refreshed;
    if (accessTokenIsExpired(row.expiresAt)) return null;
  }

  if (accessTokenIsExpired(row.expiresAt) && !row.refreshToken) {
    return null;
  }

  return { shop: row.shop, accessToken: row.accessToken, scope: row.scope };
}

/**
 * Run a Shopify Admin API call with automatic token refresh + one retry on auth failure.
 */
export async function withShopifySiteAuth<T>(
  siteId: string,
  fn: (creds: ShopifySiteCreds) => Promise<T>,
): Promise<T> {
  let creds = await getValidShopifyAccessToken(siteId);
  if (!creds) {
    throw new ShopifyApiError(
      "Shopify connection expired. Reopen tidyAgent from Shopify Admin → Apps, then scan again.",
      401,
    );
  }

  try {
    return await fn(creds);
  } catch (error) {
    if (!isShopifyAuthFailure(error)) throw error;
    const refreshed = await refreshShopifyAccessTokenForSite(siteId);
    if (!refreshed) throw error;
    creds = refreshed;
    return await fn(creds);
  }
}

export async function shopifyGraphqlForSite<T>(
  siteId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return withShopifySiteAuth(siteId, (creds) =>
    shopifyGraphql<T>(creds.shop, creds.accessToken, query, variables),
  );
}

export async function shopifyGetForSite<T>(siteId: string, path: string): Promise<T> {
  return withShopifySiteAuth(siteId, (creds) => shopifyGet<T>(creds.shop, creds.accessToken, path));
}
