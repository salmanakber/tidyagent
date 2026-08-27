import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { WEBFLOW_SCOPE_STRING } from "@/modules/webflow/scopes";

const MESSAGES: Record<string, { title: string; body: string }> = {
  disabled: {
    title: "Webflow is turned off",
    body: "Enable Webflow in Admin → Settings, then click Install again in Webflow.",
  },
  not_configured: {
    title: "Webflow credentials are missing",
    body: "Save the Webflow client ID and secret in Admin → Settings, then install the app again.",
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
    title: "Permissions do not match the App",
    body: `The install URL asked for scopes that are not enabled on this Webflow App. In the Webflow App dashboard, enable exactly these Data Client scopes (and no extras): ${WEBFLOW_SCOPE_STRING}. Then try Connect again.`,
  },
  invalid_request: {
    title: "Webflow rejected the install request",
    body: "Check that the App’s redirect URI is exactly https://agent.tidyflowapp.com/api/webflow/oauth/callback and that the client ID in Admin → Settings matches this App.",
  },
  unauthorized_client: {
    title: "Webflow client is not authorized",
    body: "The client ID / secret in Admin → Settings may be wrong for this App, or the App is not published/available for install. Update credentials and try again.",
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
    body: "The login token arrived, then Webflow did not return the site list. Click Connect Webflow again.",
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
        <div className="mt-6 grid gap-3">
          <a href="/webflow/install?popup=1" className="btn-primary" target="_blank" rel="noopener">
            Connect Webflow again
          </a>
          <Link href="/install/webflow" className="btn-secondary">
            Install &amp; permissions guide
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign in with email
          </Link>
        </div>
      </div>
    </div>
  );
}
