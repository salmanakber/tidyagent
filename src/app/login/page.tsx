import Link from "next/link";
import { loginWithEmail } from "@/app/actions/owner-auth";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
import { wixInstallUrl, wixReconnectUrl } from "@/modules/billing/catalog";
import { shopifyDocsPath } from "@/modules/legal/platform";
import { shopifyReconnectPath } from "@/modules/shopify/open";

const ERRORS: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  exists: "That email already has an account. Sign in instead.",
  google: "Google sign-in is not configured, or it was cancelled.",
};

type LoginPlatform = "wix" | "shopify" | "webflow";

function normalizePlatform(value?: string | null): LoginPlatform {
  const key = value?.trim().toLowerCase();
  if (key === "shopify") return "shopify";
  if (key === "webflow" || key === "wf") return "webflow";
  return "wix";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; disconnected?: string; platform?: string; shop?: string }>;
}) {
  const params = await searchParams;
  const disconnected = params.disconnected === "1";
  const platform = normalizePlatform(params.platform);
  const shop = params.shop?.trim() || "";
  const reconnectUrl = wixReconnectUrl();
  const installUrl = wixInstallUrl();
  const shopifyReconnect = shop ? shopifyReconnectPath(shop) : null;

  if (platform === "shopify") {
    return (
      <AuthShell
        eyebrow={disconnected ? "Disconnected" : "Shopify"}
        headline={disconnected ? "Reconnect tidyAgent to your store." : "Open tidyAgent from Shopify Admin."}
        body="tidyAgent signs you in through Shopify when you open the app from Admin → Apps. Email and Wix sign-in are not used for Shopify stores."
      >
        <AuthCard
          title={disconnected ? "Reconnect" : "Shopify sign-in"}
          subtitle="Open tidyAgent inside Shopify Admin so we can refresh your store connection."
          submitLabel="Sign in"
          error={params.error ? ERRORS[params.error] ?? "Could not sign in." : undefined}
          lead={
            <>
              {shopifyReconnect ? (
                <a href={shopifyReconnect} className="btn-primary w-full">
                  Reconnect {shop}
                </a>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-navy-200">
                  In Shopify Admin, go to <strong className="text-white">Apps → tidyAgent</strong>. Stay in the Admin
                  iframe while the dashboard loads.
                </p>
              )}
              <p className="text-xs leading-5 text-navy-400">
                Guide:{" "}
                <Link href={shopifyDocsPath()} className="text-amber-300 hover:underline">
                  {shopifyDocsPath()}
                </Link>
              </p>
            </>
          }
        />
      </AuthShell>
    );
  }

  if (platform === "webflow") {
    return (
      <AuthShell
        eyebrow={disconnected ? "Disconnected" : "Webflow"}
        headline={disconnected ? "Reconnect tidyAgent to your Webflow site." : "Open tidyAgent from Webflow."}
        body="tidyAgent signs you in through Webflow when you launch the app from the Designer or Marketplace. Wix sign-in is not used for Webflow sites."
      >
        <AuthCard
          title={disconnected ? "Reconnect" : "Webflow sign-in"}
          subtitle="Launch tidyAgent from Webflow to approve Data Client access again."
          submitLabel="Sign in"
          error={params.error ? ERRORS[params.error] ?? "Could not sign in." : undefined}
          lead={
            <>
              <a href="/webflow" className="btn-primary w-full">
                Open tidyAgent for Webflow
              </a>
              <p className="text-xs leading-5 text-navy-400">
                Or launch the Designer Extension on your site, then approve permissions. Guide:{" "}
                <Link href="/docs/webflow" className="text-amber-300 hover:underline">
                  /docs/webflow
                </Link>
              </p>
            </>
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={disconnected ? "Disconnected" : "Your workspace"}
      headline={disconnected ? "Reconnect to pick up where you left off." : "Pick up where your AI employee left off."}
      body={
        disconnected
          ? "Your tidyAgent session was cleared. Open the app from Wix again to authenticate this site, or sign in with email if you created an account."
          : "Sign in with Wix to authenticate this site, or use email / Google if you already have a tidyAgent login."
      }
    >
      <AuthCard
        title={disconnected ? "Reconnect" : "Sign in"}
        subtitle={
          disconnected
            ? "Wix has to sign this site again. That takes a few seconds."
            : "Reconnect with Wix, or use email and password."
        }
        action={loginWithEmail}
        submitLabel="Sign in"
        error={params.error ? ERRORS[params.error] ?? "Could not sign in." : undefined}
        lead={
          <>
            <a href={reconnectUrl} className="btn-primary w-full">
              Reconnect with Wix
            </a>
            <p className="text-xs leading-5 text-navy-400">
              Choose the Wix site, then open tidyAgent. Wix sends a signed instance so we can log you back in. You can
              also open <span className="text-navy-200">Dashboard → Apps → tidyAgent</span> on the site.
            </p>
            {installUrl ? (
              <a href={installUrl} className="btn-secondary w-full">
                Install on a Wix site
              </a>
            ) : null}
          </>
        }
        footer={
          <>
            No account yet?{" "}
            <Link href="/signup" className="text-amber-300">
              Create one
            </Link>
          </>
        }
      />
    </AuthShell>
  );
}
