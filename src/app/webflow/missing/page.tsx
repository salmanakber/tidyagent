import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const MESSAGES: Record<string, { title: string; body: string }> = {
  disabled: {
    title: "Webflow installs are paused",
    body: "tidyAgent isn’t accepting new Webflow installs right now. Please try again later.",
  },
  not_configured: {
    title: "Webflow install isn’t ready",
    body: "tidyAgent isn’t ready for Webflow installs yet. Please try again later.",
  },
  denied: {
    title: "Install was cancelled",
    body: "You (or Webflow) did not grant access. Click Connect Webflow again and approve every permission on the consent screen.",
  },
  access_denied: {
    title: "Install was cancelled",
    body: "You (or Webflow) did not grant access. Click Connect Webflow again and approve every permission on the consent screen.",
  },
  invalid_scope: {
    title: "Permissions do not match",
    body: "Webflow didn’t grant the permissions tidyAgent needs. Reinstall from the Webflow Marketplace and approve every permission on the consent screen.",
  },
  invalid_request: {
    title: "Webflow rejected the install request",
    body: "Something went wrong starting install. Open tidyAgent from the Webflow Marketplace again.",
  },
  unauthorized_client: {
    title: "Webflow could not authorize this app",
    body: "Reinstall tidyAgent from the Webflow Marketplace. If it keeps failing, contact support.",
  },
  oauth_server: {
    title: "Webflow had a temporary error",
    body: "Try Connect Webflow again in a moment.",
  },
  missing_code: {
    title: "No authorization code",
    body: "Open Install from Webflow again. This page only works after Webflow sends a one-time code.",
  },
  invalid_state: {
    title: "Install link expired",
    body: "Start again from Webflow or from the install link. Authorization codes cannot be reused.",
  },
  no_site: {
    title: "No Webflow site was authorized",
    body: "Install again and select the site that should get tidyAgent.",
  },
  api: {
    title: "Webflow connected, but we could not load the site",
    body: "The login finished, then Webflow did not return the site list. Click Connect Webflow again.",
  },
  token: {
    title: "Could not finish Webflow login",
    body: "Authorization codes can only be used once. Click Connect Webflow again to complete the connection.",
  },
};

export default async function WebflowMissingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const key = params.error ?? "";
  const copy = MESSAGES[key] ?? {
    title: "Webflow install did not finish",
    body: "Click Connect Webflow again. Do not refresh the callback URL — that code can only be used once.",
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <Logo href="/" />
        <h1 className="mt-6 font-display text-2xl text-white">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">{copy.body}</p>
        {params.detail ? (
          <p className="mt-3 break-words rounded-2xl bg-navy-950/50 px-3 py-2 text-left text-xs text-navy-400">
            {params.detail}
          </p>
        ) : null}
        <Link href="/webflow" className="btn-primary mt-6 inline-flex">
          Connect Webflow
        </Link>
      </div>
    </div>
  );
}
