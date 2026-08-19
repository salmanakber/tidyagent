import Link from "next/link";
import { signUpWithEmail } from "@/app/actions/owner-auth";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";

const ERRORS: Record<string, string> = {
  invalid: "Use a valid email and a password of at least 8 characters.",
  google: "Google sign-in is not configured, or it was cancelled.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      eyebrow="Get started"
      headline="Create a workspace. No sample store. No prompts to write."
      body="Connect Wix next. tidyAgent learns the business from the site itself."
    >
      <AuthCard
        title="Create account"
        subtitle="You’ll start with an empty workspace — not demo data."
        action={signUpWithEmail}
        submitLabel="Create account"
        extraFields={<input className="field" name="name" placeholder="Your name" />}
        error={params.error ? ERRORS[params.error] ?? "Could not create the account." : undefined}
        footer={
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-amber-300">
              Sign in
            </Link>
          </>
        }
      />
    </AuthShell>
  );
}
