import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/env";
import { getSession } from "@/lib/security/session";
import { createStripeBillingPortalSession } from "@/modules/billing/stripe/checkout";
import { isWebflowPlatform, resolveSitePlatform } from "@/modules/platforms";

export const dynamic = "force-dynamic";

/** Card billing portal for Webflow subscriptions only. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", getAppOrigin()));
  }
  if (!isWebflowPlatform(resolveSitePlatform(session.platform))) {
    return NextResponse.redirect(new URL("/billing", getAppOrigin()));
  }

  try {
    const portal = await createStripeBillingPortalSession({
      organizationId: session.organizationId,
      email: session.email,
    });
    return NextResponse.redirect(portal.url);
  } catch (error) {
    console.error("Billing portal failed", error);
    return NextResponse.redirect(new URL("/billing?error=billing_portal", getAppOrigin()));
  }
}
