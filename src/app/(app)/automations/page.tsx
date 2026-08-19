import { PageHeader } from "@/components/ui/PageHeader";

export default function AutomationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Later phase"
        title="Automations"
        description="After the text agent is stable, automations reuse the same knowledge, tools, and business rules. Nothing to configure as a flowchart today."
      />
      <div className="panel p-8">
        <p className="text-sm leading-7 text-navy-200">
          Coming after human handoff and ecommerce tools are proven. Owners will approve meaningful changes — the AI will
          never silently rewrite policies.
        </p>
      </div>
    </div>
  );
}
