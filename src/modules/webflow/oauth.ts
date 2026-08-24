import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";
import type { AppSession } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { entitlementsForOrganization } from "@/modules/billing/service";
import { getWebflowOAuthConfig } from "@/modules/platforms/marketplace";
import { exchangeWebflowCode, webflowGet } from "@/modules/webflow/client";
import { injectWebflowWidget } from "@/modules/webflow/embed";
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

export async function createWebflowOAuthState() {
  return new SignJWT({ intent: "webflow-install" })
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

  if (input.state) {
    try {
      await jwtVerify(input.state, new TextEncoder().encode(getEnv().SESSION_SECRET));
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
  const site = pickWebflowSite(sites, input.preferredSiteId);
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

  try {
    await injectWebflowWidget({
      accessToken: tokens.accessToken,
      webflowSiteId: site.id,
      widgetSrc: config.widgetSrc,
      instanceId: session.wixInstanceId,
    });
  } catch (error) {
    console.error("Webflow widget inject failed", error);
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
  });
  const entitlements = await entitlementsForOrganization(session.organizationId);
  const setupComplete = organization.onboardingStatus === "PUBLISHED";

  return {
    session,
    destination: !entitlements.isPaidSeat
      ? "/billing"
      : setupComplete
        ? "/dashboard"
        : "/onboarding",
  };
}
