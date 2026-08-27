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

export async function createWebflowOAuthState(input?: {
  embed?: boolean;
  popup?: boolean;
  siteId?: string;
}) {
  return new SignJWT({
    intent: "webflow-install",
    embed: Boolean(input?.embed),
    popup: Boolean(input?.popup),
    siteId: input?.siteId || null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(getEnv().SESSION_SECRET));
}

export async function readWebflowOAuthState(state?: string | null) {
  if (!state) return { ours: false, embed: false, popup: false, siteId: null as string | null };
  try {
    const { payload } = await jwtVerify(state, new TextEncoder().encode(getEnv().SESSION_SECRET));
    return {
      ours: true,
      embed: Boolean(payload.embed),
      popup: Boolean(payload.popup),
      siteId: typeof payload.siteId === "string" && payload.siteId ? payload.siteId : null,
    };
  } catch {
    // Marketplace / Open app often send Webflow's own state. Do not consume the code
    // by failing before the token exchange — Connect again would then be required.
    return { ours: false, embed: false, popup: false, siteId: null as string | null };
  }
}

const inflightLogins = new Map<
  string,
  Promise<{ session: AppSession; destination: string; popup: boolean }>
>();

export async function completeWebflowLogin(input: {
  code: string;
  state?: string | null;
  preferredSiteId?: string | null;
}): Promise<{ session: AppSession; destination: string; popup: boolean }> {
  const existing = inflightLogins.get(input.code);
  if (existing) return existing;
  const work = completeWebflowLoginOnce(input).finally(() => {
    setTimeout(() => inflightLogins.delete(input.code), 60_000);
  });
  inflightLogins.set(input.code, work);
  return work;
}

async function completeWebflowLoginOnce(input: {
  code: string;
  state?: string | null;
  preferredSiteId?: string | null;
}): Promise<{ session: AppSession; destination: string; popup: boolean }> {
  const config = await getWebflowOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new WebflowInstallError(
      "not_configured",
      "Webflow client ID and secret are not saved in Admin → Settings.",
    );
  }

  const state = await readWebflowOAuthState(input.state);
  const preferredSiteId = input.preferredSiteId || state.siteId;

  let tokens;
  try {
    tokens = await exchangeWebflowCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: input.code,
      redirectUri: config.redirectUri,
    });
  } catch (error) {
    throw new WebflowInstallError(
      "token",
      error instanceof Error ? error.message : "Webflow token exchange failed.",
    );
  }

  const user = await webflowGet<WebflowAuthorizedUser>(
    tokens.accessToken,
    "/v2/token/authorized_by",
  ).catch(() => null);

  let listed: { sites?: WebflowSiteRecord[] } | WebflowSiteRecord[];
  try {
    listed = await webflowGet<{ sites?: WebflowSiteRecord[] } | WebflowSiteRecord[]>(
      tokens.accessToken,
      "/v2/sites",
    );
  } catch (error) {
    throw new WebflowInstallError(
      "api",
      error instanceof Error ? error.message : "Could not list Webflow sites.",
    );
  }
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

  const workspace = await workspacePathForOrganization(session.organizationId);
  return {
    session,
    popup: state.popup,
    destination: state.popup ? "/webflow/connected" : workspace,
  };
}
