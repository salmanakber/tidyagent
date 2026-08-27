import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";
import type { AppSession } from "@/lib/security/session";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { exchangeShopifyCode, fetchShopifyShop } from "@/modules/shopify/client";
import { ensureShopifyWidgetForSite } from "@/modules/shopify/embed";
import { verifyShopifyQueryHmac } from "@/modules/shopify/hmac";
import { provisionTenantFromShopify } from "@/modules/shopify/provision";
import { SHOPIFY_SCOPE_STRING } from "@/modules/shopify/scopes";
import { normalizeShopifyShop } from "@/modules/shopify/shop";
import { shopifyEmbeddedAdminAppUrl } from "@/modules/shopify/open";

export class ShopifyInstallError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ShopifyInstallError";
  }
}

export function shopifyAuthorizeUrl(input: {
  shop: string;
  apiKey: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(`https://${input.shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", input.apiKey);
  url.searchParams.set("scope", SHOPIFY_SCOPE_STRING);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function createShopifyOAuthState(input: { shop: string; embed?: boolean }) {
  return new SignJWT({
    intent: "shopify-install",
    shop: input.shop,
    embed: Boolean(input.embed),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(getEnv().SESSION_SECRET));
}

export async function readShopifyOAuthState(state?: string | null) {
  if (!state) return { ours: false, shop: null as string | null, embed: false };
  try {
    const { payload } = await jwtVerify(state, new TextEncoder().encode(getEnv().SESSION_SECRET));
    return {
      ours: true,
      shop: typeof payload.shop === "string" ? payload.shop : null,
      embed: Boolean(payload.embed),
    };
  } catch {
    return { ours: false, shop: null as string | null, embed: false };
  }
}

const inflightLogins = new Map<string, Promise<{ session: AppSession; destination: string }>>();

export async function completeShopifyLogin(input: {
  search: URLSearchParams;
}): Promise<{ session: AppSession; destination: string }> {
  const code = input.search.get("code") ?? "";
  const key = `${input.search.get("shop") ?? ""}:${code}`;
  const existing = inflightLogins.get(key);
  if (existing) return existing;
  const work = completeShopifyLoginOnce(input).finally(() => {
    setTimeout(() => inflightLogins.delete(key), 60_000);
  });
  inflightLogins.set(key, work);
  return work;
}

async function completeShopifyLoginOnce(input: {
  search: URLSearchParams;
}): Promise<{ session: AppSession; destination: string }> {
  const config = await getShopifyOAuthConfig();
  if (!config.apiKey || !config.apiSecret) {
    throw new ShopifyInstallError(
      "not_configured",
      "Shopify API key and secret are not saved in Admin → Settings.",
    );
  }

  const shop = normalizeShopifyShop(input.search.get("shop"));
  if (!shop) {
    throw new ShopifyInstallError("no_shop", "Shopify did not send a valid shop domain.");
  }
  if (!verifyShopifyQueryHmac(input.search, config.apiSecret)) {
    throw new ShopifyInstallError("invalid_hmac", "Shopify HMAC did not match.");
  }

  const code = input.search.get("code");
  if (!code) {
    throw new ShopifyInstallError("missing_code", "Shopify did not send an authorization code.");
  }

  const state = await readShopifyOAuthState(input.search.get("state"));
  if (state.ours && state.shop && state.shop !== shop) {
    throw new ShopifyInstallError("invalid_state", "OAuth shop did not match.");
  }

  let tokens;
  try {
    tokens = await exchangeShopifyCode({
      shop,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      code,
    });
  } catch (error) {
    throw new ShopifyInstallError(
      "token",
      error instanceof Error ? error.message : "Shopify token exchange failed.",
    );
  }

  const shopRecord = await fetchShopifyShop(shop, tokens.accessToken).catch(() => null);
  const session = await provisionTenantFromShopify({
    shop,
    shopRecord,
    accessToken: tokens.accessToken,
    scope: tokens.scope,
  });

  await ensureShopifyWidgetForSite(session.siteId, tokens.accessToken);

  let destination = await workspacePathForOrganization(session.organizationId);
  if (state.embed) {
    const embedded = shopifyEmbeddedAdminAppUrl(shop, config.apiKey);
    if (embedded) destination = embedded;
  }

  return {
    session,
    destination,
  };
}
