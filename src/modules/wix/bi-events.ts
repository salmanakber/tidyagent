import { createWixAppClient } from "@/services/wix/client";

export type WixBiEventName =
  | "APP_DASHBOARD_LOADED"
  | "APP_FINISHED_CONFIGURATION"
  | "APP_SETUP_FINISHED"
  | "APP_UPGRADED"
  | "PRIMARY_ACTION_PERFORMED";

/**
 * Wix App Market BI events.
 * Docs: https://dev.wix.com/docs/build-apps/manage-your-app/data-and-analytics/bi-events
 * Failures never block the product — Wix metrics are best-effort.
 */
export function shouldSendWixBiEvent(instanceId?: string | null) {
  if (!instanceId) return false;
  if (instanceId.startsWith("pending:")) return false;
  if (instanceId.startsWith("demo-")) return false;
  return true;
}

export function wixCycleName(cycle?: string | null) {
  const value = (cycle ?? "").toLowerCase().replace(/[_-]/g, " ").trim();
  if (!value) return undefined;
  if (value.includes("2 year") || value === "2 years") return "2 years";
  if (value.includes("year") || value.includes("annual")) return "yearly";
  if (value.includes("month")) return "monthly";
  if (value.includes("one time") || value.includes("onetime") || value.includes("lifetime")) {
    return "one time";
  }
  return undefined;
}

export function wixUpgradeEventData(input: {
  vendorProductId?: string | null;
  cycle?: string | null;
  reason?: string;
}) {
  const eventData: Record<string, string> = {};
  if (input.vendorProductId) eventData.app_plan_id = input.vendorProductId;
  const cycle = wixCycleName(input.cycle);
  if (cycle) eventData.cycle_name = cycle;
  if (input.reason) eventData.reason = input.reason;
  return eventData;
}

export async function sendWixBiEvent(
  instanceId: string,
  eventName: WixBiEventName,
  eventData?: Record<string, string>,
) {
  if (!shouldSendWixBiEvent(instanceId)) return;
  try {
    const client = createWixAppClient(instanceId);
    await client.biEvents.sendBiEvent({
      eventName,
      ...(eventData && Object.keys(eventData).length ? { eventData } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "send failed";
    console.error("[wix-bi]", eventName, message);
  }
}

export function reportDashboardLoaded(instanceId: string, setupComplete = false) {
  void sendWixBiEvent(instanceId, "APP_DASHBOARD_LOADED");
  if (setupComplete) {
    void sendWixBiEvent(instanceId, "APP_FINISHED_CONFIGURATION");
  }
}

export async function reportSetupFinished(instanceId: string) {
  await sendWixBiEvent(instanceId, "APP_SETUP_FINISHED");
  await sendWixBiEvent(instanceId, "APP_FINISHED_CONFIGURATION");
}

export function reportAppUpgraded(
  instanceId: string,
  input: { vendorProductId?: string | null; cycle?: string | null; reason?: string },
) {
  void sendWixBiEvent(instanceId, "APP_UPGRADED", wixUpgradeEventData(input));
}

export function reportPrimaryAction(instanceId?: string | null) {
  if (!instanceId) return;
  void sendWixBiEvent(instanceId, "PRIMARY_ACTION_PERFORMED");
}
