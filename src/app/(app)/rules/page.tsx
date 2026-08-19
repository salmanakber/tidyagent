import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { RulesList } from "@/components/rules/RulesList";

export default async function RulesPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const workspace = await getWorkspace(session);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Guardrails"
        title="Business rules"
        description="Sensible defaults are already on. You can toggle them. You never have to build conditional logic."
      />
      <RulesList rules={workspace.agent?.rules ?? []} />
    </div>
  );
}
