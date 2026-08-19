import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/security/admin-session";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <AdminShell email={session.email} role={session.role}>
      {children}
    </AdminShell>
  );
}
