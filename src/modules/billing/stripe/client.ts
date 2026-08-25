import Stripe from "stripe";
import { getStripeRuntimeConfig } from "@/modules/billing/stripe/config";

let cached: { key: string; client: Stripe } | null = null;

export async function getStripeClient(): Promise<Stripe | null> {
  const config = await getStripeRuntimeConfig();
  if (!config.secretKey) return null;
  if (cached?.key === config.secretKey) return cached.client;
  const client = new Stripe(config.secretKey, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  cached = { key: config.secretKey, client };
  return client;
}
