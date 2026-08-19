import { createClient, AppStrategy } from "@wix/sdk";
import { appInstances, embeddedScripts, billing } from "@wix/app-management";
import { products, collections as storeCatalogs } from "@wix/stores";
import { collections as cmsCollections, items as cmsItems } from "@wix/data";
import { siteProperties } from "@wix/business-tools";
import { getEnv } from "@/lib/env";

export function createWixAppClient(instanceId: string) {
  const env = getEnv();
  if (!env.WIX_APP_ID || !env.WIX_APP_SECRET) {
    throw new Error("Wix app credentials are not configured");
  }

  return createClient({
    auth: AppStrategy({
      appId: env.WIX_APP_ID,
      appSecret: env.WIX_APP_SECRET,
      publicKey: env.WIX_APP_PUBLIC_KEY || undefined,
      instanceId,
    }),
    modules: {
      appInstances,
      embeddedScripts,
      billing,
      products,
      storeCatalogs,
      cmsCollections,
      cmsItems,
      siteProperties,
    },
  });
}

export type WixSiteSnapshot = {
  instanceId: string;
  isFree: boolean;
  vendorProductId?: string | null;
  permissions: string[];
  originInstanceId?: string | null;
  billing?: {
    packageName?: string;
    billingCycle?: string;
    expirationDate?: string;
    autoRenewing?: boolean;
    freeTrialStatus?: string;
    freeTrialEndDate?: string;
  } | null;
  site: {
    siteId?: string;
    displayName?: string;
    url?: string;
    locale?: string;
    currency?: string;
    description?: string;
    ownerEmail?: string;
    installedWixApps: string[];
  };
};

function orUndef<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export async function fetchWixAppInstance(instanceId: string): Promise<WixSiteSnapshot> {
  const client = createWixAppClient(instanceId);
  const response = await client.appInstances.getAppInstance();
  const instance = response.instance;
  const site = response.site;

  return {
    instanceId: instance?.instanceId ?? instanceId,
    isFree: instance?.isFree ?? true,
    vendorProductId: instance?.billing?.packageName ?? null,
    permissions: instance?.permissions ?? [],
    originInstanceId: instance?.originInstanceId ?? null,
    billing: instance?.billing
      ? {
          packageName: orUndef(instance.billing.packageName),
          billingCycle: orUndef(instance.billing.billingCycle),
          expirationDate: orUndef(instance.billing.expirationDate),
          autoRenewing: orUndef(instance.billing.autoRenewing),
          freeTrialStatus: orUndef(instance.billing.freeTrialInfo?.status),
          freeTrialEndDate: instance.billing.freeTrialInfo?.endDate
            ? String(instance.billing.freeTrialInfo.endDate)
            : undefined,
        }
      : null,
    site: {
      siteId: orUndef(site?.siteId),
      displayName: orUndef(site?.siteDisplayName),
      url: orUndef(site?.url),
      locale: orUndef(site?.locale),
      currency: orUndef(site?.paymentCurrency),
      description: orUndef(site?.description),
      ownerEmail: orUndef(site?.ownerInfo?.email),
      installedWixApps: site?.installedWixApps ?? [],
    },
  };
}
