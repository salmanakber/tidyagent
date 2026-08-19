import Link from "next/link";
import { loginWithEmail } from "@/app/actions/owner-auth";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";

const ERRORS: Record<string, string> = {
  invalid: "Email or password is incorrect.",
  exists: "That email already has an account. Sign in instead.",
  google: "Google sign-in is not configured, or it was cancelled.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell
      eyebrow="Your workspace"
      headline="Pick up where your AI employee left off."
      body="Sign in to an empty-or-live workspace that belongs to you — never a shared demo store."
    >
      <AuthCard
        title="Sign in"
        subtitle="Email, password, or Google."
        action={loginWithEmail}
        submitLabel="Sign in"
        error={params.error ? ERRORS[params.error] ?? "Could not sign in." : undefined}
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
