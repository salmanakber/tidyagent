export {
  isWixPlatform,
  isWebflowPlatform,
  isShopifyPlatform,
  platformLabel,
  resolveSitePlatform,
  isWixInstanceTarget,
  syntheticInstanceId,
  type SitePlatform,
} from "@/modules/platforms/types";

export {
  isWebflowEnabled,
  isShopifyEnabled,
  isPlatformAdapterEnabled,
} from "@/modules/platforms/flags";

export {
  embedWidgetForSession,
  reportWixSetupFinishedForSession,
  syncWixBillingForSession,
} from "@/modules/platforms/wix-side-effects";
