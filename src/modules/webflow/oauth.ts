import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";
import type { AppSession } from "@/lib/security/session";
import { getWebflowOAuthConfig } from "@/modules/platforms/marketplace";
import { exchangeWebflowCode, webflowGet } from "@/modules/webflow/client";
import { workspacePathForOrganization } from "@/modules/auth/workspace-path";
import { ensureWebflowWidgetForSite } from "@/modules/webflow/embed";
import { provisionTenantFromWebflow, type WebflowAuthorizedUser } from "@/modules/webflow/provision";
import { WEBFLOW_SCOPE_STRING } from "@/modules/webflow/scopes";
import { pickWebflowSite, type WebflowSiteRecord } from "@/modules/webflow/sites";

export class WebflowInstallError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "WebflowInstallError";
  }
}

export function webflowAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL("https://webflow.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", WEBFLOW_SCOPE_STRING);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function createWebflowOAuthState(input?: { embed?: boolean; siteId?: string }) {
  return new SignJWT({
    intent: "webflow-install",
    embed: Boolean(input?.embed),
    siteId: input?.siteId || null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(getEnv().SESSION_SECRET));
}

export async function completeWebflowLogin(input: {
  code: string;
  state?: string | null;
  preferredSiteId?: string | null;
}): Promise<{ session: AppSession; destination: string }> {
  const config = await getWebflowOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new WebflowInstallError(
      "not_configured",
      "Webflow client ID and secret are not saved in Admin → Settings.",
    );
  }

  let preferredSiteId = input.preferredSiteId;
  if (input.state) {
    try {
      const { payload } = await jwtVerify(input.state, new TextEncoder().encode(getEnv().SESSION_SECRET));
      if (!preferredSiteId && typeof payload.siteId === "string" && payload.siteId) {
        preferredSiteId = payload.siteId;
      }
    } catch {
      throw new WebflowInstallError("invalid_state", "OAuth state did not match.");
    }
  }

  const tokens = await exchangeWebflowCode({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code: input.code,
    redirectUri: config.redirectUri,
  });

  const user = await webflowGet<WebflowAuthorizedUser>(
    tokens.accessToken,
    "/v2/token/authorized_by",
  ).catch(() => null);

  const listed = await webflowGet<{ sites?: WebflowSiteRecord[] } | WebflowSiteRecord[]>(
    tokens.accessToken,
    "/v2/sites",
  );
  const sites = Array.isArray(listed) ? listed : (listed.sites ?? []);
  const site = pickWebflowSite(sites, preferredSiteId);
  if (!site) {
    throw new WebflowInstallError(
      "no_site",
      "Webflow did not authorize any site. Reinstall and select a site.",
    );
  }

  const session = await provisionTenantFromWebflow({
    site,
    user,
    accessToken: tokens.accessToken,
    scope: tokens.scope,
  });

  await ensureWebflowWidgetForSite(session.siteId, tokens.accessToken);

  return {
    session,
    destination: await workspacePathForOrganization(session.organizationId),
  };
}
