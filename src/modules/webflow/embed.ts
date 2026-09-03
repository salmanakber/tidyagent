import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/settings";
import { getAppOrigin } from "@/lib/env";
import { getWebflowOAuthConfig } from "@/modules/platforms/marketplace";
import { isWebflowPlatform } from "@/modules/platforms/types";
import { WebflowApiError, webflowDelete, webflowGet, webflowSend } from "@/modules/webflow/client";
import {
  WEBFLOW_EMBED_DISPLAY_NAME,
  WEBFLOW_EMBED_VERSION,
  webflowEmbedHostedLocation,
  webflowEmbedIntegrityHash,
} from "@/modules/webflow/widget-script";

type RegisteredScript = {
  id?: string;
  displayName?: string;
  version?: string;
  hostedLocation?: string;
};
type AppliedScript = { id: string; location?: string; version?: string };

export type WebflowWidgetInjectResult = {
  ok: boolean;
  scriptId?: string;
  version?: string;
  hostedLocation?: string;
  integrityHash?: string;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function errorMessage(error: unknown) {
  if (error instanceof WebflowApiError || error instanceof Error) return error.message;
  return "Webflow custom code inject failed";
}

async function listScripts(accessToken: string, webflowSiteId: string) {
  try {
    const listed = await webflowGet<{
      registeredScripts?: RegisteredScript[];
      scripts?: RegisteredScript[];
    }>(accessToken, `/v2/sites/${webflowSiteId}/registered_scripts`);
    return [...(listed.registeredScripts ?? []), ...(listed.scripts ?? [])];
  } catch {
    return [];
  }
}

async function currentAppliedScripts(accessToken: string, webflowSiteId: string) {
  try {
    const current = await webflowGet<{ scripts?: AppliedScript[] }>(
      accessToken,
      `/v2/sites/${webflowSiteId}/custom_code`,
    );
    return current.scripts ?? [];
  } catch {
    return [];
  }
}

/**
 * Registers the production widget executable as a versioned hosted script with SRI,
 * then applies it at the site footer. No inline nested loaders.
 * Does not publish the Webflow site — the owner must publish for visitors to see it.
 */
export async function injectWebflowWidget(input: {
  accessToken: string;
  webflowSiteId: string;
  instanceId: string;
  origin?: string;
}): Promise<WebflowWidgetInjectResult> {
  const origin = (input.origin || getAppOrigin()).replace(/\/$/, "");
  const hostedLocation = webflowEmbedHostedLocation(origin, input.instanceId);
  const integrityHash = await webflowEmbedIntegrityHash();
  const listed = await listScripts(input.accessToken, input.webflowSiteId);
  const existing = listed.find(
    (row) =>
      row.displayName?.toLowerCase() === WEBFLOW_EMBED_DISPLAY_NAME.toLowerCase() ||
      row.id === WEBFLOW_EMBED_DISPLAY_NAME.toLowerCase(),
  );

  let scriptId = existing?.id || WEBFLOW_EMBED_DISPLAY_NAME.toLowerCase();
  let appliedVersion = WEBFLOW_EMBED_VERSION;

  try {
    const registered = await webflowSend<RegisteredScript>(
      input.accessToken,
      `/v2/sites/${input.webflowSiteId}/registered_scripts/hosted`,
      "POST",
      {
        hostedLocation,
        integrityHash,
        version: WEBFLOW_EMBED_VERSION,
        displayName: WEBFLOW_EMBED_DISPLAY_NAME,
        canCopy: false,
      },
    );
    if (registered.id) scriptId = registered.id;
    if (registered.version) appliedVersion = registered.version;
  } catch (registerError) {
    if (!existing?.id) {
      throw registerError instanceof Error ? registerError : new Error(errorMessage(registerError));
    }
    scriptId = existing.id;
    appliedVersion = existing.version || WEBFLOW_EMBED_VERSION;
  }

  const existingScripts = await currentAppliedScripts(input.accessToken, input.webflowSiteId);
  await webflowSend(input.accessToken, `/v2/sites/${input.webflowSiteId}/custom_code`, "PUT", {
    scripts: [
      ...existingScripts.filter((row) => row.id !== scriptId),
      { id: scriptId, location: "footer", version: appliedVersion },
    ],
  });

  return {
    ok: true,
    scriptId,
    version: appliedVersion,
    hostedLocation,
    integrityHash,
  };
}

/**
 * Removes tidyAgent’s applied site Custom Code during uninstall / disconnect.
 * Uses DELETE (App-applied scripts only), then PUT remaining non-tidyAgent scripts if needed.
 * Unrelated customer / other-app scripts are preserved. Does not publish — caller must prompt publish.
 */
export async function removeWebflowWidget(input: {
  accessToken: string;
  webflowSiteId: string;
  scriptId?: string | null;
}): Promise<WebflowWidgetInjectResult> {
  const listed = await listScripts(input.accessToken, input.webflowSiteId);
  const tidyIds = new Set(
    listed
      .filter(
        (row) =>
          row.displayName?.toLowerCase() === WEBFLOW_EMBED_DISPLAY_NAME.toLowerCase() ||
          row.id?.toLowerCase() === WEBFLOW_EMBED_DISPLAY_NAME.toLowerCase() ||
          (input.scriptId && row.id === input.scriptId),
      )
      .map((row) => row.id)
      .filter(Boolean) as string[],
  );
  if (input.scriptId) tidyIds.add(input.scriptId);

  // Official uninstall path: remove all site Custom Code applied by this App.
  // Webflow scopes this to the calling App — other apps’ / merchant scripts stay.
  try {
    await webflowDelete(input.accessToken, `/v2/sites/${input.webflowSiteId}/custom_code`);
  } catch (deleteError) {
    // Fallback: rewrite applied list without tidyAgent only (preserve any shared entries).
    const existingScripts = await currentAppliedScripts(input.accessToken, input.webflowSiteId);
    const remaining = existingScripts.filter((row) => !tidyIds.has(row.id));
    await webflowSend(input.accessToken, `/v2/sites/${input.webflowSiteId}/custom_code`, "PUT", {
      scripts: remaining,
    }).catch((putError) => {
      throw deleteError instanceof Error ? deleteError : putError;
    });
  }

  return { ok: true, scriptId: input.scriptId ?? undefined };
}

/**
 * Full uninstall cleanup for a tidyAgent Webflow site while the OAuth token is still valid.
 * Removes Custom Code, marks the site disconnected, clears stored widget metadata.
 */
export async function uninstallWebflowSite(siteId: string): Promise<{
  ok: boolean;
  removed: boolean;
  error?: string;
  siteName?: string | null;
  siteUrl?: string | null;
}> {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isWebflowPlatform(site.platform) || !site.webflowSiteId) {
    return { ok: false, removed: false, error: "not_webflow" };
  }

  const metadata = asRecord(site.credential?.metadata);
  const accessToken = decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) {
    await prisma.wixSite.update({
      where: { id: siteId },
      data: { connectionStatus: "uninstalled", accessStatus: "revoked", lastSyncedAt: new Date() },
    });
    return {
      ok: false,
      removed: false,
      error: "missing_token",
      siteName: site.displayName,
      siteUrl: site.url,
    };
  }

  const result = await removeWebflowWidget({
    accessToken,
    webflowSiteId: site.webflowSiteId,
    scriptId: typeof metadata.widgetScriptId === "string" ? metadata.widgetScriptId : null,
  });

  await prisma.wixCredential.updateMany({
    where: { siteId },
    data: {
      metadata: asJson({
        ...metadata,
        accessToken: metadata.accessToken,
        widgetInjectedAt: null,
        widgetInjectError: result.ok ? null : result.error ?? "remove_failed",
        widgetRemovedAt: new Date().toISOString(),
        widgetScriptId: null,
        widgetScriptVersion: null,
        widgetHostedLocation: null,
        widgetIntegrityHash: null,
        uninstallPublishRequired: true,
      }),
    },
  });

  await prisma.wixSite.update({
    where: { id: siteId },
    data: {
      connectionStatus: result.ok ? "uninstalled" : site.connectionStatus,
      accessStatus: result.ok ? "revoked" : site.accessStatus,
      lastSyncedAt: new Date(),
    },
  });

  return {
    ok: result.ok,
    removed: result.ok,
    error: result.error,
    siteName: site.displayName,
    siteUrl: site.url,
  };
}

export async function removeWebflowWidgetForSite(siteId: string): Promise<WebflowWidgetInjectResult> {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isWebflowPlatform(site.platform) || !site.webflowSiteId) {
    return { ok: false, error: "not_webflow" };
  }

  const metadata = asRecord(site.credential?.metadata);
  const accessToken = decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) {
    return { ok: false, error: "missing_token" };
  }

  try {
    const result = await removeWebflowWidget({
      accessToken,
      webflowSiteId: site.webflowSiteId,
      scriptId: typeof metadata.widgetScriptId === "string" ? metadata.widgetScriptId : null,
    });
    await prisma.wixCredential.updateMany({
      where: { siteId },
      data: {
        metadata: asJson({
          ...metadata,
          widgetInjectedAt: null,
          widgetInjectError: null,
          widgetRemovedAt: new Date().toISOString(),
          widgetScriptId: null,
          widgetScriptVersion: null,
          widgetHostedLocation: null,
          widgetIntegrityHash: null,
        }),
      },
    });
    return result;
  } catch (error) {
    console.error("Webflow widget remove failed", error);
    return { ok: false, error: errorMessage(error) };
  }
}

export async function ensureWebflowWidgetForSite(
  siteId: string,
  accessTokenOverride?: string,
): Promise<WebflowWidgetInjectResult> {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isWebflowPlatform(site.platform) || !site.webflowSiteId) {
    return { ok: false, error: "not_webflow" };
  }

  const metadata = asRecord(site.credential?.metadata);
  const accessToken = accessTokenOverride || decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) {
    const result = { ok: false, error: "missing_token" };
    await saveInjectResult(siteId, metadata, result);
    return result;
  }

  const config = await getWebflowOAuthConfig();
  try {
    const result = await injectWebflowWidget({
      accessToken,
      webflowSiteId: site.webflowSiteId,
      instanceId: site.wixInstanceId,
      origin: config.origin || getAppOrigin(),
    });
    await saveInjectResult(siteId, metadata, result);
    return result;
  } catch (error) {
    const result = { ok: false, error: errorMessage(error) };
    console.error("Webflow widget inject failed", error);
    await saveInjectResult(siteId, metadata, result);
    return result;
  }
}

async function saveInjectResult(
  siteId: string,
  metadata: Record<string, unknown>,
  result: WebflowWidgetInjectResult,
) {
  await prisma.wixCredential.updateMany({
    where: { siteId },
    data: {
      metadata: asJson({
        ...metadata,
        widgetInjectedAt: result.ok ? new Date().toISOString() : metadata.widgetInjectedAt ?? null,
        widgetInjectError: result.ok ? null : result.error ?? "inject_failed",
        widgetScriptId: result.scriptId ?? metadata.widgetScriptId ?? null,
        widgetScriptVersion: result.version ?? metadata.widgetScriptVersion ?? null,
        widgetHostedLocation: result.hostedLocation ?? metadata.widgetHostedLocation ?? null,
        widgetIntegrityHash: result.integrityHash ?? metadata.widgetIntegrityHash ?? null,
      }),
    },
  });
}

export async function webflowWidgetStatus(siteId: string) {
  const credential = await prisma.wixCredential.findUnique({ where: { siteId } });
  const metadata = asRecord(credential?.metadata);
  return {
    injectedAt: typeof metadata.widgetInjectedAt === "string" ? metadata.widgetInjectedAt : null,
    error: typeof metadata.widgetInjectError === "string" ? metadata.widgetInjectError : null,
  };
}
