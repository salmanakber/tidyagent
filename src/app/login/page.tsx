import Link from "next/link";
import { loginWithEmail } from "@/app/actions/owner-auth";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
import { wixInstallUrl, wixReconnectUrl } from "@/modules/billing/catalog";

const ERRORS: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  exists: "That email already has an account. Sign in instead.",
  google: "Google sign-in is not configured, or it was cancelled.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; disconnected?: string }>;
}) {
  const params = await searchParams;
  const disconnected = params.disconnected === "1";
  const reconnectUrl = wixReconnectUrl();
  const installUrl = wixInstallUrl();

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
              Choose the Wix site, then open tidyAgent. Wix sends a signed instance so we can log you back in.
              You can also open <span className="text-navy-200">Dashboard → Apps → tidyAgent</span> on the site.
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
