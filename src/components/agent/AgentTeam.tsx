"use client";

import { useState, useTransition } from "react";
import { createSpecialistAgent, deleteAgent } from "@/app/actions/workspace";
import { maxAgentsForPlan, SPECIALTIES, WIDGET_TEMPLATES } from "@/modules/agents/team";
import type { AgentSpecialty, KnowledgeContentType, PlanKey } from "@prisma/client";

export function AgentTeam({
  agents,
  planKey,
  hasStores,
  hasBookings,
  contentTypes,
}: {
  agents: {
    id: string;
    name: string;
    role: string;
    isPrimary: boolean;
    specialty: AgentSpecialty;
    knowledgeScopes: string[];
    status: string;
  }[];
  planKey: PlanKey;
  hasStores: boolean;
  hasBookings: boolean;
  contentTypes: KnowledgeContentType[];
}) {
  const limit = maxAgentsForPlan(planKey);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("John");
  const allowedSpecialties = SPECIALTIES.filter((item) => {
    if (item.key === "GENERAL") return false;
    if (item.needs === "stores" && !hasStores) return false;
    if (item.needs === "bookings" && !hasBookings) return false;
    return true;
  });
  const [specialty, setSpecialty] = useState<Exclude<AgentSpecialty, "GENERAL">>(
    allowedSpecialties[0]?.key === "GENERAL" ? "SUPPORT" : (allowedSpecialties[0]?.key as Exclude<AgentSpecialty, "GENERAL">) || "SUPPORT",
  );
  const [scopes, setScopes] = useState<KnowledgeContentType[]>(
    SPECIALTIES.find((item) => item.key === specialty)?.defaultScopes.filter((scope) => contentTypes.includes(scope)) ?? ["PAGE"],
  );

  if (limit <= 1) {
    return (
      <div className="panel p-6">
        <h3 className="font-display text-lg text-white">Team of agents</h3>
        <p className="mt-2 text-sm text-navy-300">
          Business and Pro can add specialists (store, support, bookings) and assign each one only the data they should see.
          Starter keeps a single general agent.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <h3 className="font-display text-lg text-white">Team of agents</h3>
      <p className="mt-2 text-sm text-navy-300">
        The general agent greets visitors. Specialists only see the data you assign. This plan allows {limit} agents (
        {agents.length} in use).
      </p>
      <ul className="mt-4 space-y-2">
        {agents.map((agent) => (
          <li key={agent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-950/40 px-4 py-3">
            <div>
              <p className="text-sm text-white">
                {agent.name}
                {agent.isPrimary ? <span className="ml-2 text-xs text-amber-300">general</span> : null}
              </p>
              <p className="text-xs text-navy-400">
                {agent.role} · {agent.specialty.toLowerCase()} · {agent.knowledgeScopes.join(", ") || "no data assigned"}
              </p>
            </div>
            {!agent.isPrimary ? (
              <button
                className="btn-secondary"
                disabled={pending}
                onClick={() => startTransition(() => deleteAgent(agent.id))}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {agents.length < limit && allowedSpecialties.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-navy-300">
            Specialist name
            <input className="field mt-2" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-sm text-navy-300">
            Handles
            <select
              className="field mt-2"
              value={specialty}
              onChange={(event) => {
                const next = event.target.value as Exclude<AgentSpecialty, "GENERAL">;
                setSpecialty(next);
                setScopes(
                  SPECIALTIES.find((item) => item.key === next)?.defaultScopes.filter((scope) =>
                    contentTypes.includes(scope),
                  ) ?? ["PAGE"],
                );
              }}
            >
              {allowedSpecialties.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <p className="text-sm text-navy-300">Assigned website data</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {contentTypes.map((scope) => {
                const on = scopes.includes(scope);
                return (
                  <button
                    key={scope}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs ${on ? "bg-amber-500 text-navy-950" : "bg-white/5 text-navy-200"}`}
                    onClick={() =>
                      setScopes((current) => (current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]))
                    }
                  >
                    {scope.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            className="btn-primary sm:col-span-2"
            disabled={pending || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                await createSpecialistAgent({ name: name.trim(), specialty, knowledgeScopes: scopes });
              })
            }
          >
            Add specialist
          </button>
        </div>
      ) : null}
    </div>
  );
}
