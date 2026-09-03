import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Production Webflow Custom Code executable.
 * Self-contained chat widget — no nested remote script loaders.
 * Bump version whenever public/widget/embed.js content changes.
 */
export const WEBFLOW_EMBED_DISPLAY_NAME = "tidyAgent";
export const WEBFLOW_EMBED_VERSION = "1.1.0";
export const WEBFLOW_EMBED_PATH = "/widget/embed.js";

export function webflowEmbedCanonicalUrl(origin: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${WEBFLOW_EMBED_PATH}?v=${WEBFLOW_EMBED_VERSION}`;
}

/** Hosted location applied via Custom Code API (instance is config, not mutable code). */
export function webflowEmbedHostedLocation(origin: string, instanceId: string) {
  const url = new URL(webflowEmbedCanonicalUrl(origin));
  url.searchParams.set("instance", instanceId);
  return url.toString();
}

export async function webflowEmbedIntegrityHash(): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "widget", "embed.js");
  const bytes = await readFile(filePath);
  return `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
}
