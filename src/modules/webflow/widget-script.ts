import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Production Webflow Custom Code (Data Client) — ONE path only:
 * 1) POST …/registered_scripts/inline — compact loader (≤2000 chars)
 * 2) That loader loads https://{origin}/widget.js?v=&instance=
 * 3) PUT …/custom_code — apply at footer
 *
 * /widget.js is the chat UI executable (rewritten to the same bytes as
 * /widget/embed.js). It does NOT create another remote <script> tag.
 * Hosted registration is never used.
 *
 * Bump WEBFLOW_EMBED_VERSION when the inline loader or chat UI contract changes.
 */
export const WEBFLOW_EMBED_DISPLAY_NAME = "tidyAgent";
export const WEBFLOW_EMBED_VERSION = "1.3.1";
export const WEBFLOW_WIDGET_PATH = "/widget.js";

/** On-disk chat UI file (served at /widget.js via Next rewrite). */
export const WEBFLOW_CHAT_UI_FILE = path.join("public", "widget", "embed.js");

export function webflowWidgetCanonicalUrl(origin: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${WEBFLOW_WIDGET_PATH}`;
}

/** Production executable URL loaded by the inline loader (instance is config). */
export function webflowWidgetExecutableLocation(origin: string, instanceId: string) {
  const url = new URL(webflowWidgetCanonicalUrl(origin));
  url.searchParams.set("instance", instanceId);
  url.searchParams.set("v", WEBFLOW_EMBED_VERSION);
  return url.toString();
}

/**
 * Inline sourceCode for POST …/registered_scripts/inline.
 * Must stay under Webflow’s 2000-character limit.
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

/** sha384 of the chat UI bytes served at /widget.js */
export async function webflowWidgetIntegrityHash(): Promise<string> {
  const filePath = path.join(process.cwd(), WEBFLOW_CHAT_UI_FILE);
  const bytes = await readFile(filePath);
  return `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
}

/** @deprecated Use webflowWidgetIntegrityHash */
export const webflowEmbedIntegrityHash = webflowWidgetIntegrityHash;

/** @deprecated Use webflowWidgetCanonicalUrl */
export function webflowEmbedCanonicalUrl(origin: string) {
  return webflowWidgetCanonicalUrl(origin);
}

/** @deprecated Use webflowWidgetExecutableLocation */
export function webflowEmbedHostedLocation(origin: string, instanceId: string) {
  return webflowWidgetExecutableLocation(origin, instanceId);
}
