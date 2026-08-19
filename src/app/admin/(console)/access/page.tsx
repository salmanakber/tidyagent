import { getOperatorEmails } from "@/lib/security/admin-session";
import { getAdminSession } from "@/lib/security/admin-session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminAccessPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const emails = await getOperatorEmails();
  const admins = await prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operators"
        title="Admin access"
        description="Operator emails and the console password are managed in Settings — not in environment variables."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Allowed emails</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {emails.map((email) => (
              <li key={email} className="rounded-2xl bg-navy-950/40 px-4 py-3">
                {email}
                {email === session.email ? <span className="ml-2 text-amber-300">you</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-navy-300">
            Change login email and password in{" "}
            <Link href="/admin/settings" className="text-amber-300">
              Settings
            </Link>
            .
          </p>
        </div>
        <div className="panel p-6">
          <h2 className="font-display text-xl text-white">Signed-in operators</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {admins.length === 0 ? (
              <li className="text-navy-300">No logins recorded yet.</li>
            ) : (
              admins.map((admin) => (
                <li key={admin.id} className="flex justify-between rounded-2xl bg-navy-950/40 px-4 py-3">
                  <span>
                    {admin.email}
                    <span className="ml-2 text-navy-400">{admin.role}</span>
                  </span>
                  <span className="text-navy-400">{admin.lastLoginAt?.toLocaleDateString() ?? "—"}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
