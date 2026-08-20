"use client";

import { useState, useTransition } from "react";
import { createSpecialistAgent, deleteAgent, updateAgent } from "@/app/actions/workspace";
import { SPECIALTIES } from "@/modules/agents/team";
import { AvatarPicker } from "@/components/agent/AvatarPicker";
import { VoiceSelect, VoiceTestButton } from "@/components/voice/VoiceTestButton";
import { DEFAULT_VOICE_ID } from "@/modules/voice/voices";
import type { AgentSpecialty, KnowledgeContentType, PlanKey } from "@prisma/client";

export function AgentTeam({
  agents,
  maxAgents = 1,
  hasStores,
  hasBookings,
  contentTypes,
  voiceOnPlan = false,
}: {
  agents: {
    id: string;
    name: string;
    role: string;
    isPrimary: boolean;
    specialty: AgentSpecialty;
    knowledgeScopes: string[];
    status: string;
    widgetAvatarUrl?: string | null;
    voiceId?: string | null;
  }[];
  planKey?: PlanKey;
  maxAgents?: number;
  hasStores: boolean;
  hasBookings: boolean;
  contentTypes: KnowledgeContentType[];
  voiceOnPlan?: boolean;
}) {
  const limit = maxAgents;
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
          This plan includes one general agent. Specialists unlock when the plan’s agent limit is raised.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <h3 className="font-display text-lg text-white">Team of agents</h3>
      <p className="mt-2 text-sm text-navy-300">
        The general agent greets visitors. Specialists only see the data you assign. Click a photo to set it, and pick a
        different spoken voice for each person. This plan allows {limit} agents ({agents.length} in use).
      </p>
      <ul className="mt-4 space-y-3">
        {agents.map((agent) => (
          <li key={agent.id} className="space-y-3 rounded-2xl bg-navy-950/40 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarPicker
                compact
                name={agent.name}
                url={agent.widgetAvatarUrl}
                onChange={(url) => startTransition(() => updateAgent({ agentId: agent.id, widgetAvatarUrl: url ?? "" }))}
              />
              <div>
                <p className="text-sm text-white">
                  {agent.name}
                  {agent.isPrimary ? <span className="ml-2 text-xs text-amber-300">general</span> : null}
                </p>
                <p className="text-xs text-navy-400">
                  {agent.role} · {agent.specialty.toLowerCase()} · {agent.knowledgeScopes.join(", ") || "no data assigned"}
                </p>
              </div>
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
            </div>
            {voiceOnPlan ? (
              <div className="flex items-center gap-2">
                <VoiceSelect
                  compact
                  value={agent.voiceId || DEFAULT_VOICE_ID}
                  onChange={(id) => startTransition(() => updateAgent({ agentId: agent.id, voiceId: id }))}
                />
                <VoiceTestButton
                  compact
                  preview
                  voiceId={agent.voiceId || DEFAULT_VOICE_ID}
                  sample={`Hi, I’m ${agent.name}. This is how I sound.`}
                />
              </div>
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
