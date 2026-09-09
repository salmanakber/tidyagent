import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Production Webflow Custom Code (Data Client).
 * Registers an inline loader that loads https://{origin}/widget.js — not hosted embed.js.
 * Inline sourceCode must stay under Webflow’s 2000-character limit.
 * Bump version whenever the inline loader or widget.js bootstrap contract changes.
 */
export const WEBFLOW_EMBED_DISPLAY_NAME = "tidyAgent";
export const WEBFLOW_EMBED_VERSION = "1.3.0";
export const WEBFLOW_WIDGET_PATH = "/widget.js";

/** @deprecated Use WEBFLOW_WIDGET_PATH — kept for any remaining hosted-path references. */
export const WEBFLOW_EMBED_PATH = "/widget/embed.js";

export function webflowWidgetCanonicalUrl(origin: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${WEBFLOW_WIDGET_PATH}`;
}

/** Production executable URL applied via the inline loader (instance is config). */
export function webflowWidgetExecutableLocation(origin: string, instanceId: string) {
  const url = new URL(webflowWidgetCanonicalUrl(origin));
  url.searchParams.set("instance", instanceId);
  url.searchParams.set("v", WEBFLOW_EMBED_VERSION);
  return url.toString();
}

/**
 * Inline sourceCode registered with POST …/registered_scripts/inline.
 * Loads the production executable widget.js (under 2000 chars).
 */
export function webflowInlineLoaderSource(origin: string, instanceId: string) {
  const base = origin.replace(/\/$/, "");
  const source =
    `(function(o,i){var d=document,s=d.createElement("script");` +
    `s.src=o+"/widget.js?v=${WEBFLOW_EMBED_VERSION}&instance="+encodeURIComponent(i);` +
    `s.async=true;s.setAttribute("data-instance",i);` +
    `(d.body||d.documentElement).appendChild(s);})(${JSON.stringify(base)},${JSON.stringify(instanceId)});`;
  if (source.length > 2000) {
    throw new Error(`Webflow inline loader exceeds 2000 characters (${source.length})`);
  }
  return source;
}

/** @deprecated Hosted path is not used in production. Prefer webflowWidgetExecutableLocation. */
export function webflowEmbedCanonicalUrl(origin: string) {
  return webflowWidgetCanonicalUrl(origin);
}

/** @deprecated Hosted path is not used in production. */
export function webflowEmbedHostedLocation(origin: string, instanceId: string) {
  return webflowWidgetExecutableLocation(origin, instanceId);
}

/** Optional integrity for audits — not required for inline registration. */
export async function webflowEmbedIntegrityHash(): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "widget.js");
  const bytes = await readFile(filePath);
  return `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
}
