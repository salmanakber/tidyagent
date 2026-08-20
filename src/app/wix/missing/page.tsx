import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { wixInstallUrl, wixReconnectUrl } from "@/modules/billing/catalog";

export default async function WixMissingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const invalid = params.error === "invalid";
  const reconnectUrl = wixReconnectUrl();
  const installUrl = wixInstallUrl();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <Logo href="/" />
        <h1 className="mt-6 font-display text-2xl text-white">
          {invalid ? "Could not verify this Wix site" : "Reconnect from Wix"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">
          {invalid
            ? "The instance token did not match this app. Open tidyAgent again from the Wix dashboard so we can sign the site."
            : "We need a signed Wix instance to log you in. Open tidyAgent from the site dashboard, or reconnect below."}
        </p>
        <div className="mt-6 grid gap-3">
          <a href={reconnectUrl} className="btn-primary">
            Reconnect with Wix
          </a>
          {installUrl ? (
            <a href={installUrl} className="btn-secondary">
              Install on a Wix site
            </a>
          ) : null}
          <Link href="/login" className="btn-secondary">
            Sign in with email
          </Link>
        </div>
      </div>
    </div>
  );
}
