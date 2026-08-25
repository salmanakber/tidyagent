import { getAppOrigin } from "@/lib/env";
import { getSetting, settingExists } from "@/lib/security/settings";

export type StripeRuntimeConfig = {
  configured: boolean;
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  webhookUrl: string;
  origin: string;
};

/** Stripe keys live in Admin → Settings (encrypted), same pattern as Webflow/Shopify. */
export async function getStripeRuntimeConfig(): Promise<StripeRuntimeConfig> {
  const origin = getAppOrigin();
  const [secretKey, webhookSecret, publishableKey, secretSet, webhookSet] = await Promise.all([
    getSetting("stripe_secret_key"),
    getSetting("stripe_webhook_secret"),
    getSetting("stripe_publishable_key"),
    settingExists("stripe_secret_key"),
    settingExists("stripe_webhook_secret"),
  ]);

  return {
    configured: Boolean(secretKey) && (secretSet || Boolean(secretKey)),
    secretKey,
    webhookSecret,
    publishableKey,
    webhookUrl: `${origin}/api/billing/stripe/webhook`,
    origin,
  };
}

export async function isStripeCheckoutConfigured() {
  const config = await getStripeRuntimeConfig();
  return Boolean(config.secretKey);
}
