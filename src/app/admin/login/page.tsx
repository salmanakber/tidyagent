import { Logo } from "@/components/brand/Logo";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AuthShell } from "@/components/auth/AuthCard";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      eyebrow="Platform owner"
      headline="One console for every connected Wix site."
      body="Billing, access, and impersonation live here. Tenant workspaces stay next door."
    >
      <div className="w-full max-w-md rounded-[28px] border border-amber-400/15 bg-navy-900/55 p-8 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <Logo href="/" />
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
          Operator console
        </p>
        <h2 className="mt-2 font-display text-3xl text-white">Sign in</h2>
        <p className="mt-2 text-sm text-navy-300">
          Email and password are set in Platform admin → Settings after first login.
        </p>
        <AdminLoginForm error={Boolean(params.error)} />
      </div>
    </AuthShell>
  );
}
