import { widgetInlineSource } from "@/modules/webflow/sites";
import { webflowGet, webflowSend } from "@/modules/webflow/client";

const SCRIPT_NAME = "tidyAgent";
const SCRIPT_VERSION = "1.0.0";

type RegisteredScript = { id?: string; displayName?: string; version?: string };

/**
 * Registers the widget loader and applies it at site footer.
 * Does not publish the Webflow site — the owner must publish for it to go live.
 */
export async function injectWebflowWidget(input: {
  accessToken: string;
  webflowSiteId: string;
  widgetSrc: string;
  instanceId: string;
}) {
  const sourceCode = widgetInlineSource(input.widgetSrc, input.instanceId);
  let scriptId = SCRIPT_NAME.toLowerCase();

  try {
    const registered = await webflowSend<RegisteredScript>(
      input.accessToken,
      `/v2/sites/${input.webflowSiteId}/registered_scripts/inline`,
      "POST",
      {
        sourceCode,
        version: SCRIPT_VERSION,
        displayName: SCRIPT_NAME,
        canCopy: false,
      },
    );
    if (registered.id) scriptId = registered.id;
  } catch (error) {
    const listed = await webflowGet<{ registeredScripts?: RegisteredScript[]; scripts?: RegisteredScript[] }>(
      input.accessToken,
      `/v2/sites/${input.webflowSiteId}/registered_scripts`,
    ).catch(() => ({ registeredScripts: [] as RegisteredScript[], scripts: [] as RegisteredScript[] }));
    const existing = [...(listed.registeredScripts ?? []), ...(listed.scripts ?? [])].find(
      (row) => row.displayName?.toLowerCase() === SCRIPT_NAME.toLowerCase() || row.id === scriptId,
    );
    if (existing?.id) scriptId = existing.id;
    else throw error;
  }

  let existingScripts: { id: string; location?: string; version?: string }[] = [];
  try {
    const current = await webflowGet<{ scripts?: { id: string; location?: string; version?: string }[] }>(
      input.accessToken,
      `/v2/sites/${input.webflowSiteId}/custom_code`,
    );
    existingScripts = current.scripts ?? [];
  } catch {
    existingScripts = [];
  }

  const nextScripts = [
    ...existingScripts.filter((row) => row.id !== scriptId),
    { id: scriptId, location: "footer", version: SCRIPT_VERSION },
  ];

  await webflowSend(input.accessToken, `/v2/sites/${input.webflowSiteId}/custom_code`, "PUT", {
    scripts: nextScripts,
  });
}
