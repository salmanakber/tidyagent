"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { PlanKey } from "@prisma/client";
import { toggleWorkflow } from "@/app/actions/workspace";
import { AUTOMATION_CATALOG, type AutomationKey } from "@/modules/automations/catalog";
import { planLabel } from "@/modules/billing/catalog";

export function AutomationsBoard({
  planKey,
  allowed,
  rows,
}: {
  planKey: PlanKey;
  allowed: Partial<Record<AutomationKey, boolean>>;
  rows: { key: string; enabled: boolean }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      {AUTOMATION_CATALOG.map((item) => {
        const onPlan = Boolean(allowed[item.key]);
        const saved = rows.find((row) => row.key === item.key || item.aliases.includes(row.key));
        const on = onPlan && (saved?.enabled ?? true);
        return (
          <label
            key={item.key}
            className={`panel flex items-start justify-between gap-4 p-5 ${onPlan ? "" : "opacity-70"}`}
          >
            <span>
              <span className="block text-sm font-medium text-white">{item.label}</span>
              <span className="mt-1 block text-sm leading-6 text-navy-300">{item.blurb}</span>
              {!onPlan ? (
                <Link href="/billing" className="mt-2 inline-block text-xs text-amber-300 hover:underline">
                  Not included on {planLabel(planKey)} — upgrade
                </Link>
              ) : (
                <span className="mt-2 block text-[11px] uppercase tracking-[0.14em] text-navy-400">
                  Included on {planLabel(planKey)}
                </span>
              )}
            </span>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={on}
              disabled={pending || !onPlan}
              onChange={(event) => {
                const enabled = event.target.checked;
                startTransition(async () => {
                  await toggleWorkflow(item.key, enabled);
                });
              }}
            />
          </label>
        );
      })}
    </div>
  );
}
