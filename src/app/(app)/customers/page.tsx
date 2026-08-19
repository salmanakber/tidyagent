import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { scopedCustomers } from "@/modules/organizations/workspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { initials, relativeTime } from "@/lib/utils";

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const customers = await scopedCustomers(session);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People"
        title="Customers"
        description="Memory is tenant-isolated. We only keep useful authorized information from previous visits."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {customers.length === 0 ? (
          <div className="panel p-8 text-sm text-navy-300 sm:col-span-2">No identified customers yet.</div>
        ) : (
          customers.map((customer) => (
            <article key={customer.id} className="panel p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-navy text-sm font-semibold">
                  {initials(customer.name || customer.email || "C")}
                </div>
                <div>
                  <h2 className="text-sm font-medium text-white">{customer.name || "Unnamed"}</h2>
                  <p className="text-xs text-navy-300">{customer.email || "No email yet"}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-navy-400">Updated {relativeTime(customer.updatedAt)}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
