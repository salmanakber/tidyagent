import type { AppSession } from "@/lib/security/session";
import { isWixPlatform } from "@/modules/platforms/types";

/** Wix Embedded Script inject. No-op for Webflow/Shopify sessions. */
export async function embedWidgetForSession(session: AppSession, disabled = false) {
  if (!isWixPlatform(session.platform)) return;
  const wixEmbed = await import("@/modules/wix/embed");
  await wixEmbed.embedSiteWidget(session.wixInstanceId, disabled);
}

/** Wix App Market BI. No-op for Webflow/Shopify sessions. */
export async function reportWixSetupFinishedForSession(session: AppSession) {
  if (!isWixPlatform(session.platform)) return;
  const wixBi = await import("@/modules/wix/bi-events");
  await wixBi.reportSetupFinished(session.wixInstanceId);
}

/** Wix Pricing sync. No-op for Webflow/Shopify sessions. */
export async function syncWixBillingForSession(session: AppSession) {
  if (!isWixPlatform(session.platform)) return;
  const billing = await import("@/modules/billing/service");
  await billing.syncSubscriptionFromWix(session.wixInstanceId);
}
