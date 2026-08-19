"use client";

import { useTransition } from "react";
import { toggleRule } from "@/app/actions/workspace";

export function RulesList({
  rules,
}: {
  rules: { id: string; description: string; enabled: boolean }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="panel divide-y divide-white/5">
      {rules.map((rule) => (
        <label key={rule.id} className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="text-sm text-navy-100">{rule.description}</span>
          <input
            type="checkbox"
            defaultChecked={rule.enabled}
            disabled={pending}
            onChange={(event) => {
              startTransition(async () => {
                await toggleRule(rule.id, event.target.checked);
              });
            }}
          />
        </label>
      ))}
    </div>
  );
}
