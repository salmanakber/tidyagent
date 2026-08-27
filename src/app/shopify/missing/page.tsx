import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const MESSAGES: Record<string, { title: string; body: string }> = {
  disabled: {
    title: "Shopify is turned off",
    body: "Enable Shopify in Admin → Settings, then install the app again from Shopify.",
  },
  not_configured: {
    title: "Shopify credentials are missing",
    body: "Save the Shopify API key and secret in Admin → Settings, then install again.",
  },
  denied: {
    title: "Install was cancelled",
    body: "Shopify did not grant access. You can start the install again when you are ready.",
  },
  missing_code: {
    title: "No authorization code",
    body: "Open the app from Shopify again. This page only works after Shopify sends a one-time code.",
  },
  invalid_hmac: {
    title: "Shopify signature did not match",
    body: "The install link was altered or the API secret in Admin → Settings is wrong.",
  },
  invalid_state: {
    title: "Install link expired",
    body: "Start again from Shopify. Authorization codes cannot be reused.",
  },
  no_shop: {
    title: "No Shopify store was provided",
    body: "Open tidyAgent from the Shopify admin for the store you want to connect.",
  },
  token: {
    title: "Could not finish Shopify login",
    body: "The authorization code is one-time. Click Connect Shopify again from the store admin.",
  },
};

export default async function ShopifyMissingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const copy = MESSAGES[params.error ?? ""] ?? {
    title: "Shopify install did not finish",
    body: "Open the app from Shopify again. Do not refresh the callback URL — that code can only be used once.",
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <Logo href="/" />
        <h1 className="mt-6 font-display text-2xl text-white">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">{copy.body}</p>
        <div className="mt-6 grid gap-3">
          <Link href="/install/shopify" className="btn-primary">
            Install &amp; permissions guide
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign in with email
          </Link>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
