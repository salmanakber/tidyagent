import { getAllPlanScopes } from "@/modules/billing/plan-scope-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanScopesForm } from "@/components/admin/PlanScopesForm";

export default async function AdminPlansPage() {
  const scopes = await getAllPlanScopes();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Packages"
        title="Plan scopes"
        description="Raise or lower limits and turn features on or off per Wix package. Checkout still happens in Wix — this only controls what each paid plan can do after purchase."
      />
      <PlanScopesForm initial={scopes} />
    </div>
  );
}
