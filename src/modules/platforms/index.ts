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

export { isPlatformAdapterEnabled } from "@/modules/platforms/flags";

export {
  getMarketplaceAdapterConfig,
  isWebflowAdapterEnabled,
  isShopifyAdapterEnabled,
} from "@/modules/platforms/marketplace";

export {
  embedWidgetForSession,
  reportWixSetupFinishedForSession,
  syncWixBillingForSession,
} from "@/modules/platforms/wix-side-effects";
