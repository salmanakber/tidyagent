import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { getDashboardOverview } from "@/modules/analytics/overview";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddKnowledgeForm } from "@/components/knowledge/AddKnowledgeForm";

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/");
  const data = await getDashboardOverview(session);

  const cards = [
    { label: "Website", value: data.knowledge.pages, hint: "pages" },
    { label: "Products", value: data.knowledge.products, hint: "products" },
    { label: "FAQs", value: data.knowledge.faqs, hint: "FAQs" },
    { label: "Policies", value: data.knowledge.policies, hint: "policies" },
    { label: "Custom knowledge", value: data.knowledge.custom, hint: "notes" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Business knowledge"
        title="What your AI employee knows"
        description="No embeddings, chunk sizes, or vector scores here — just the business information customers will be answered from."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="panel p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-navy-300">{card.label}</p>
            <p className="mt-3 font-display text-3xl text-white">{card.value}</p>
            <p className="mt-1 text-xs text-navy-400">{card.hint}</p>
          </div>
        ))}
      </div>
      <AddKnowledgeForm lastSynced={data.knowledge.lastSyncedAt?.toISOString() ?? null} />
    </div>
  );
}
