import { createWixAppClient } from "@/services/wix/client";
import { getEnv } from "@/lib/env";

export async function embedSiteWidget(instanceId: string, disabled = false) {
  try {
    const client = createWixAppClient(instanceId);
    const componentId = getEnv().WIX_EMBEDDED_SCRIPT_COMPONENT_ID || undefined;
    await client.embeddedScripts.embedScript(
      {
        parameters: { instanceId },
        disabled,
      },
      componentId ? { componentId } : undefined,
    );
  } catch {
    // Missing Embedded Script extension or permission — widget snippet still works.
  }
}
