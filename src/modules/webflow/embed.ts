import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/settings";
import { getWebflowOAuthConfig } from "@/modules/platforms/marketplace";
import { isWebflowPlatform } from "@/modules/platforms/types";
import { WebflowApiError, webflowGet, webflowSend } from "@/modules/webflow/client";
import { widgetInlineSource } from "@/modules/webflow/sites";

const SCRIPT_NAME = "tidyAgent";
const SCRIPT_VERSION = "1.0.0";

type RegisteredScript = { id?: string; displayName?: string; version?: string };
type AppliedScript = { id: string; location?: string; version?: string };

export type WebflowWidgetInjectResult = {
  ok: boolean;
  scriptId?: string;
  version?: string;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function nextVersion(current?: string | null) {
  if (!current || !/^\d+\.\d+\.\d+$/.test(current)) return SCRIPT_VERSION;
  const [major, minor, patch] = current.split(".").map(Number);
  return `${major}.${minor}.${(patch || 0) + 1}`;
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
 * Registers the widget loader and applies it at the site footer.
 * Does not publish the Webflow site — the owner must publish for visitors to see it.
 */
export async function injectWebflowWidget(input: {
  accessToken: string;
  webflowSiteId: string;
  widgetSrc: string;
  instanceId: string;
}): Promise<WebflowWidgetInjectResult> {
  const sourceCode = widgetInlineSource(input.widgetSrc, input.instanceId);
  const hostedLocation = `${input.widgetSrc}${input.widgetSrc.includes("?") ? "&" : "?"}instance=${encodeURIComponent(input.instanceId)}`;
  const listed = await listScripts(input.accessToken, input.webflowSiteId);
  const existing = listed.find(
    (row) =>
      row.displayName?.toLowerCase() === SCRIPT_NAME.toLowerCase() ||
      row.id === SCRIPT_NAME.toLowerCase(),
  );
  const version = existing?.version ? nextVersion(existing.version) : SCRIPT_VERSION;
  let scriptId = existing?.id || SCRIPT_NAME.toLowerCase();
  let appliedVersion = existing?.version || version;

  try {
    const registered = await webflowSend<RegisteredScript>(
      input.accessToken,
      `/v2/sites/${input.webflowSiteId}/registered_scripts/inline`,
      "POST",
      {
        sourceCode,
        version,
        displayName: SCRIPT_NAME,
        canCopy: false,
      },
    );
    if (registered.id) scriptId = registered.id;
    if (registered.version) appliedVersion = registered.version;
  } catch (inlineError) {
    try {
      const hosted = await webflowSend<RegisteredScript>(
        input.accessToken,
        `/v2/sites/${input.webflowSiteId}/registered_scripts/hosted`,
        "POST",
        {
          hostedLocation,
          version,
          displayName: SCRIPT_NAME,
          canCopy: false,
        },
      );
      if (hosted.id) scriptId = hosted.id;
      if (hosted.version) appliedVersion = hosted.version;
    } catch (hostedError) {
      if (!existing?.id) {
        throw inlineError instanceof Error ? inlineError : new Error(errorMessage(hostedError));
      }
    }
  }

  const existingScripts = await currentAppliedScripts(input.accessToken, input.webflowSiteId);
  await webflowSend(input.accessToken, `/v2/sites/${input.webflowSiteId}/custom_code`, "PUT", {
    scripts: [
      ...existingScripts.filter((row) => row.id !== scriptId),
      { id: scriptId, location: "footer", version: appliedVersion },
    ],
  });

  return { ok: true, scriptId, version: appliedVersion };
}

/**
 * Removes only tidyAgent’s applied site Custom Code. Leaves all other scripts untouched.
 * Call before logout / uninstall while the OAuth token is still valid.
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
          row.displayName?.toLowerCase() === SCRIPT_NAME.toLowerCase() ||
          row.id?.toLowerCase() === SCRIPT_NAME.toLowerCase() ||
          (input.scriptId && row.id === input.scriptId),
      )
      .map((row) => row.id)
      .filter(Boolean) as string[],
  );
  if (input.scriptId) tidyIds.add(input.scriptId);

  const existingScripts = await currentAppliedScripts(input.accessToken, input.webflowSiteId);
  const remaining = existingScripts.filter((row) => !tidyIds.has(row.id));
  await webflowSend(input.accessToken, `/v2/sites/${input.webflowSiteId}/custom_code`, "PUT", {
    scripts: remaining,
  });

  return { ok: true, scriptId: input.scriptId ?? undefined };
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
        metadata: {
          ...metadata,
          widgetInjectedAt: null,
          widgetInjectError: null,
          widgetRemovedAt: new Date().toISOString(),
          widgetScriptId: null,
          widgetScriptVersion: null,
        },
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
      widgetSrc: config.widgetSrc,
      instanceId: site.wixInstanceId,
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
      metadata: {
        ...metadata,
        widgetInjectedAt: result.ok ? new Date().toISOString() : metadata.widgetInjectedAt ?? null,
        widgetInjectError: result.ok ? null : result.error ?? "inject_failed",
        widgetScriptId: result.scriptId ?? metadata.widgetScriptId ?? null,
        widgetScriptVersion: result.version ?? metadata.widgetScriptVersion ?? null,
      },
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
