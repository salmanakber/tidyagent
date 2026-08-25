import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

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
    body: "Webflow did not grant access. You can start the install again when you are ready.",
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
    body: "The first marketplace redirect sometimes sends a one-time code before our app is ready. Click Connect Webflow again — that second pass is the one that sticks.",
  },
};

export default async function WebflowMissingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const copy = MESSAGES[params.error ?? ""] ?? {
    title: "Webflow install did not finish",
    body: "Click Install in Webflow again. Do not refresh the callback URL — that code can only be used once.",
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-gradient p-6 text-center">
      <div className="panel max-w-md p-8">
        <Logo href="/" />
        <h1 className="mt-6 font-display text-2xl text-white">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-navy-300">{copy.body}</p>
        <div className="mt-6 grid gap-3">
          <a href="/webflow/install" className="btn-primary">
            Connect Webflow again
          </a>
          <Link href="/install?platform=webflow" className="btn-secondary">
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
