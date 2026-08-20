"use client";

import { useMemo, useState, useTransition } from "react";
import { resolveKnowledgeConflict } from "@/app/actions/workspace";

type IndexedPage = {
  id: string;
  title: string;
  sourceUrl: string | null;
  contentType: string;
  status: "crawled" | "discovered" | "failed";
  origin: string;
};

export function KnowledgeIntelligence({
  facts,
  conflicts,
  pages,
}: {
  facts: { id: string; kind: string; entity: string; value: string; sourceUrl: string | null; confidence: string; extractionMethod: string }[];
  conflicts: { id: string; entity: string; kind: string; values: { value?: string; sourceUrl?: string }[] }[];
  pages: IndexedPage[];
}) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "pages" | "products" | "pending">("all");

  const counts = useMemo(() => {
    return {
      crawled: pages.filter((page) => page.status === "crawled" && page.contentType !== "PRODUCT").length,
      products: pages.filter((page) => page.contentType === "PRODUCT" && page.status === "crawled").length,
      pending: pages.filter((page) => page.status !== "crawled").length,
    };
  }, [pages]);

  const visible = pages.filter((page) => {
    if (filter === "pages") return page.contentType !== "PRODUCT" && page.status === "crawled";
    if (filter === "products") return page.contentType === "PRODUCT";
    if (filter === "pending") return page.status !== "crawled";
    return true;
  });

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
        <h2 className="font-display text-xl text-white">Crawled pages and catalog</h2>
        <p className="mt-2 text-sm text-navy-300">
          {counts.crawled} website page{counts.crawled === 1 ? "" : "s"} read
          {counts.products ? ` · ${counts.products} store product${counts.products === 1 ? "" : "s"}` : ""}
          {counts.pending ? ` · ${counts.pending} found but not yet read` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} count={pages.length} />
          <FilterChip label="Pages crawled" active={filter === "pages"} onClick={() => setFilter("pages")} count={counts.crawled} />
          <FilterChip label="Store products" active={filter === "products"} onClick={() => setFilter("products")} count={counts.products} />
          {counts.pending ? (
            <FilterChip label="Not crawled yet" active={filter === "pending"} onClick={() => setFilter("pending")} count={counts.pending} />
          ) : null}
        </div>
        <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">
          {visible.length ? (
            visible.map((page) => (
              <div key={page.id} className="flex items-center justify-between gap-3 rounded-2xl bg-navy-950/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{page.title}</p>
                  <p className="truncate text-[11px] text-navy-500">{page.sourceUrl}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-navy-400">{originLabel(page.origin, page.contentType)}</p>
                  <p className={page.status === "crawled" ? "text-[11px] text-emerald-300" : page.status === "failed" ? "text-[11px] text-rose-300" : "text-[11px] text-amber-200"}>
                    {statusLabel(page.status)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-navy-400">Run the scanner to list every page and store product that was read.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "btn-primary text-xs" : "btn-secondary text-xs"}
    >
      {label} ({count})
    </button>
  );
}

function statusLabel(status: IndexedPage["status"]) {
  if (status === "crawled") return "Crawled";
  if (status === "failed") return "Could not read";
  return "Found, not crawled yet";
}

function originLabel(origin: string, contentType: string) {
  if (origin === "wix-store" || contentType === "PRODUCT") return "Wix Stores";
  if (origin === "wix-cms") return "Wix CMS";
  if (origin === "wix-site") return "Wix site";
  return contentType;
}
