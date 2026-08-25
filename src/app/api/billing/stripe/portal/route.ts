import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/env";
import { getSession } from "@/lib/security/session";
import { createStripeBillingPortalSession } from "@/modules/billing/stripe/checkout";
import { isWixPlatform, resolveSitePlatform } from "@/modules/platforms";

export const dynamic = "force-dynamic";

/** Stripe Customer Portal for managing Webflow (non-Wix) subscriptions. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", getAppOrigin()));
  }
  if (isWixPlatform(resolveSitePlatform(session.platform))) {
    return NextResponse.redirect(new URL("/billing", getAppOrigin()));
  }

  try {
    const portal = await createStripeBillingPortalSession({
      organizationId: session.organizationId,
      email: session.email,
    });
    return NextResponse.redirect(portal.url);
  } catch (error) {
    console.error("Stripe portal failed", error);
    return NextResponse.redirect(new URL("/billing?error=stripe_portal", getAppOrigin()));
  }
}
