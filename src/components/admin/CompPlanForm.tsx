"use client";

import { useState, useTransition } from "react";
import { grantComplimentaryPlan, revokeComplimentaryPlan } from "@/app/actions/admin";

export function CompPlanForm({
  siteId,
  canGrant,
  currentPlan,
  grantedBy,
  grantedAt,
  note,
}: {
  siteId: string;
  canGrant: boolean;
  currentPlan: "STARTER" | "GROWTH" | "PRO" | null;
  grantedBy: string | null;
  grantedAt: Date | string | null;
  note: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<"STARTER" | "GROWTH" | "PRO">(currentPlan ?? "STARTER");
  const [grantNote, setGrantNote] = useState(note ?? "");

  return (
    <div className="panel p-6">
      <h2 className="font-display text-xl text-white">Complimentary seat</h2>
      <p className="mt-2 text-sm text-navy-300">
        Assign a paid plan without a Wix purchase. Use this for testing and real complimentary access. It survives Wix
        billing sync; revoke it when the seat should follow Wix again.
      </p>

      {currentPlan ? (
        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Active grant: <span className="font-semibold">{label(currentPlan)}</span>
          {grantedBy ? ` · by ${grantedBy}` : ""}
          {grantedAt ? ` · ${new Date(grantedAt).toLocaleDateString()}` : ""}
          {note ? <p className="mt-1 text-amber-100/80">{note}</p> : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-navy-400">No complimentary seat on this site.</p>
      )}

      {canGrant ? (
        <div className="mt-5 space-y-3">
          <label className="block text-sm text-navy-300">
            Plan
            <select className="field mt-2" value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)}>
              <option value="STARTER">Starter</option>
              <option value="GROWTH">Business</option>
              <option value="PRO">Pro</option>
            </select>
          </label>
          <label className="block text-sm text-navy-300">
            Note (optional)
            <input
              className="field mt-2"
              value={grantNote}
              onChange={(event) => setGrantNote(event.target.value)}
              placeholder="QA account, partner, etc."
              maxLength={200}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => startTransition(() => grantComplimentaryPlan(siteId, plan, grantNote || undefined))}
            >
              {currentPlan ? "Update grant" : "Grant paid access"}
            </button>
            {currentPlan ? (
              <button
                className="btn-secondary"
                disabled={pending}
                onClick={() => startTransition(() => revokeComplimentaryPlan(siteId))}
              >
                Revoke grant
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-navy-400">Only a SUPER admin can grant or revoke complimentary seats.</p>
      )}
    </div>
  );
}

function label(plan: "STARTER" | "GROWTH" | "PRO") {
  return plan === "GROWTH" ? "Business" : plan === "STARTER" ? "Starter" : "Pro";
}
