import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/settings";
import { getShopifyOAuthConfig } from "@/modules/platforms/marketplace";
import { isShopifyPlatform } from "@/modules/platforms/types";
import { ShopifyApiError, shopifyGet, shopifySend } from "@/modules/shopify/client";

type ScriptTag = { id?: number; src?: string };

export type ShopifyWidgetInjectResult = {
  ok: boolean;
  scriptTagId?: number;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function errorMessage(error: unknown) {
  if (error instanceof ShopifyApiError || error instanceof Error) return error.message;
  return "Shopify script tag inject failed";
}

function widgetSrcForInstance(widgetSrc: string, instanceId: string) {
  const url = new URL(widgetSrc);
  url.searchParams.set("instance", instanceId);
  return url.toString();
}

/**
 * Installs the storefront widget as a ScriptTag.
 * Theme app embeds are the long-term App Store path; this matches Webflow custom code for custom apps.
 */
export async function injectShopifyWidget(input: {
  shop: string;
  accessToken: string;
  widgetSrc: string;
  instanceId: string;
}): Promise<ShopifyWidgetInjectResult> {
  const src = widgetSrcForInstance(input.widgetSrc, input.instanceId);
  const listed = await shopifyGet<{ script_tags?: ScriptTag[] }>(
    input.shop,
    input.accessToken,
    "/script_tags.json",
  ).catch(() => ({ script_tags: [] as ScriptTag[] }));
  const existing = (listed.script_tags ?? []).find(
    (row) => row.src?.includes("/widget.js") && row.src.includes(input.instanceId),
  );
  if (existing?.id) {
    return { ok: true, scriptTagId: existing.id };
  }

  const created = await shopifySend<{ script_tag?: ScriptTag }>(
    input.shop,
    input.accessToken,
    "/script_tags.json",
    "POST",
    {
      script_tag: {
        event: "onload",
        src,
        display_scope: "online_store",
      },
    },
  );
  return { ok: true, scriptTagId: created.script_tag?.id };
}

export async function ensureShopifyWidgetForSite(
  siteId: string,
  accessTokenOverride?: string,
): Promise<ShopifyWidgetInjectResult> {
  const site = await prisma.wixSite.findUnique({
    where: { id: siteId },
    include: { credential: true },
  });
  if (!site || !isShopifyPlatform(site.platform) || !site.shopifyShopDomain) {
    return { ok: false, error: "not_shopify" };
  }

  const metadata = asRecord(site.credential?.metadata);
  const accessToken = accessTokenOverride || decryptSecret(String(metadata.accessToken ?? ""));
  if (!accessToken) {
    const result = { ok: false, error: "missing_token" };
    await saveInjectResult(siteId, metadata, result);
    return result;
  }

  const config = await getShopifyOAuthConfig();
  try {
    const result = await injectShopifyWidget({
      shop: site.shopifyShopDomain,
      accessToken,
      widgetSrc: config.widgetSrc,
      instanceId: site.wixInstanceId,
    });
    await saveInjectResult(siteId, metadata, result);
    return result;
  } catch (error) {
    const result = { ok: false, error: errorMessage(error) };
    console.error("Shopify widget inject failed", error);
    await saveInjectResult(siteId, metadata, result);
    return result;
  }
}

async function saveInjectResult(
  siteId: string,
  metadata: Record<string, unknown>,
  result: ShopifyWidgetInjectResult,
) {
  await prisma.wixCredential.updateMany({
    where: { siteId },
    data: {
      metadata: {
        ...metadata,
        widgetInjectedAt: result.ok ? new Date().toISOString() : metadata.widgetInjectedAt ?? null,
        widgetInjectError: result.ok ? null : result.error ?? "inject_failed",
        widgetScriptTagId: result.scriptTagId ?? metadata.widgetScriptTagId ?? null,
      },
    },
  });
}

export async function shopifyWidgetStatus(siteId: string) {
  const credential = await prisma.wixCredential.findUnique({ where: { siteId } });
  const metadata = asRecord(credential?.metadata);
  return {
    injectedAt: typeof metadata.widgetInjectedAt === "string" ? metadata.widgetInjectedAt : null,
    error: typeof metadata.widgetInjectError === "string" ? metadata.widgetInjectError : null,
  };
}
