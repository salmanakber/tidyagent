"use client";

import { useTransition } from "react";
import { resolveKnowledgeConflict } from "@/app/actions/workspace";

export function KnowledgeIntelligence({
  facts,
  conflicts,
  pages,
}: {
  facts: { id: string; kind: string; entity: string; value: string; sourceUrl: string | null; confidence: string; extractionMethod: string }[];
  conflicts: { id: string; entity: string; kind: string; values: { value?: string; sourceUrl?: string }[] }[];
  pages: { id: string; title: string; sourceUrl: string | null; contentType: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {conflicts.length ? (
        <section className="panel p-6">
          <h2 className="font-display text-xl text-white">Conflicts to review</h2>
          <p className="mt-2 text-sm text-navy-300">The scanner found different values for the same fact. Until you pick one, the AI will not guess.</p>
          <div className="mt-4 space-y-3">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="rounded-2xl bg-navy-950/40 p-4">
                <p className="text-sm text-white">
                  {conflict.kind}: {conflict.entity}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {conflict.values.map((item) => (
                    <button
                      key={`${item.value}-${item.sourceUrl}`}
                      className="btn-secondary text-xs"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await resolveKnowledgeConflict(conflict.id, String(item.value || ""));
                        })
                      }
                    >
                      Use {item.value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel p-6">
        <h2 className="font-display text-xl text-white">Verified facts</h2>
        <p className="mt-2 text-sm text-navy-300">Structured prices, contact details, hours, and services extracted from the live site and Wix APIs.</p>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
          {facts.length ? (
            facts.map((fact) => (
              <div key={fact.id} className="rounded-2xl bg-navy-950/40 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-navy-400">
                  {fact.kind} · {fact.confidence} · {fact.extractionMethod}
                </p>
                <p className="mt-1 text-sm text-white">
                  {fact.entity}: {fact.value}
                </p>
                {fact.sourceUrl ? (
                  <p className="mt-1 truncate text-[11px] text-navy-500">{fact.sourceUrl}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-navy-400">Run the scanner to extract facts from the live website.</p>
          )}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-xl text-white">Indexed pages</h2>
        <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between gap-3 rounded-2xl bg-navy-950/40 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{page.title}</p>
                <p className="truncate text-[11px] text-navy-500">{page.sourceUrl}</p>
              </div>
              <span className="text-[11px] uppercase tracking-[0.12em] text-navy-400">{page.contentType}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
