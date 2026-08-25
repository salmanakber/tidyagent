import { NextResponse } from "next/server";
import { getStripeClient } from "@/modules/billing/stripe/client";
import { getStripeRuntimeConfig } from "@/modules/billing/stripe/config";
import { handleStripeWebhookEvent } from "@/modules/billing/stripe/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook for Webflow/Shopify billing. Raw body + stripe-signature required.
 * Does not touch Wix billing or /api/wix/webhooks.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const config = await getStripeRuntimeConfig();

  if (!config.secretKey || !config.webhookSecret) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const stripe = await getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature failed", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeWebhookEvent(event);
  } catch (error) {
    console.error("Stripe webhook handler failed", error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
