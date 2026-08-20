"use client";

import { useState, useTransition } from "react";
import { updateAgent, toggleCapability } from "@/app/actions/workspace";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { AvatarPicker } from "@/components/agent/AvatarPicker";
import { AgentTeam } from "@/components/agent/AgentTeam";
import { StatusPill } from "@/components/ui/StatusPill";
import { WIDGET_TEMPLATES } from "@/modules/agents/team";
import type { AgentSpecialty, KnowledgeContentType, PlanKey, WidgetTemplate } from "@prisma/client";

type AgentView = {
  id: string;
  name: string;
  role: string;
  personality: string;
  status: string;
  widgetPrimaryColor: string;
  widgetGreeting: string;
  widgetPosition: "BOTTOM_RIGHT" | "BOTTOM_LEFT";
  widgetEmbedMode: "AUTO" | "MANUAL";
  widgetAvatarUrl?: string | null;
  widgetTemplate?: WidgetTemplate;
  voiceEnabled?: boolean;
  isPrimary?: boolean;
  specialty?: AgentSpecialty;
  knowledgeScopes?: string[];
  capabilities: { id: string; key: string; enabled: boolean }[];
};

export function AgentStudio({
  agent,
  agents = [],
  planKey = "STARTER",
  voiceOnPlan = false,
  hasStores = false,
  hasBookings = false,
  contentTypes = ["PAGE", "FAQ", "POLICY", "CUSTOM"],
  presentCapabilities,
}: {
  agent: AgentView;
  agents?: AgentView[];
  planKey?: PlanKey;
  voiceOnPlan?: boolean;
  hasStores?: boolean;
  hasBookings?: boolean;
  contentTypes?: KnowledgeContentType[];
  presentCapabilities?: string[];
}) {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [personality, setPersonality] = useState(agent.personality);
  const [color, setColor] = useState(agent.widgetPrimaryColor);
  const [greeting, setGreeting] = useState(agent.widgetGreeting);
  const [position, setPosition] = useState(agent.widgetPosition);
  const [avatarUrl, setAvatarUrl] = useState(agent.widgetAvatarUrl ?? null);
  const [template, setTemplate] = useState<WidgetTemplate>(agent.widgetTemplate ?? "CLASSIC");
  const [voiceOn, setVoiceOn] = useState(Boolean(agent.voiceEnabled));
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateAgent({
        name,
        role,
        personality: personality as "friendly" | "professional" | "casual" | "custom",
        widgetPrimaryColor: color,
        widgetGreeting: greeting,
        widgetPosition: position,
        widgetAvatarUrl: avatarUrl ?? "",
        widgetTemplate: template,
        voiceEnabled: voiceOn,
      });
    });
  }

  function saveAvatar(url: string | null) {
    setAvatarUrl(url);
    startTransition(async () => {
      await updateAgent({ widgetAvatarUrl: url ?? "" });
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10" />
              ) : null}
              <h2 className="truncate font-display text-2xl text-white">{name}</h2>
            </div>
            <StatusPill status={agent.status} />
          </div>
          <div className="mt-6">
            <AvatarPicker name={name} url={avatarUrl} onChange={saveAvatar} />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-navy-300">
              Display name
              <input className="field mt-2" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="text-sm text-navy-300">
              Role
              <input className="field mt-2" value={role} onChange={(event) => setRole(event.target.value)} />
            </label>
            <label className="text-sm text-navy-300">
              Personality
              <select className="field mt-2" value={personality} onChange={(event) => setPersonality(event.target.value)}>
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="text-sm text-navy-300">
              Greeting
              <input className="field mt-2" value={greeting} onChange={(event) => setGreeting(event.target.value)} />
            </label>
            <label className="text-sm text-navy-300">
              Widget color
              <input className="field mt-2" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
            <label className="text-sm text-navy-300">
              Position
              <select className="field mt-2" value={position} onChange={(event) => setPosition(event.target.value as typeof position)}>
                <option value="BOTTOM_RIGHT">Bottom right</option>
                <option value="BOTTOM_LEFT">Bottom left</option>
              </select>
            </label>
          </div>
          <div className="mt-5">
            <p className="text-sm text-navy-300">Chat template</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {WIDGET_TEMPLATES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTemplate(item.key)}
                  className={`rounded-2xl border px-4 py-3 text-left ${template === item.key ? "border-amber-400/40 bg-amber-500/10" : "border-white/10"}`}
                >
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-navy-400">{item.note}</p>
                </button>
              ))}
            </div>
          </div>
          {voiceOnPlan ? (
            <label className="mt-5 flex items-center justify-between rounded-2xl bg-navy-950/40 px-4 py-3 text-sm">
              <span>
                <span className="block text-white">Voice (Piper, local)</span>
                <span className="text-xs text-navy-400">
                  Spoken replies use OHF Piper on this server. Mic uses the browser. On by default for Pro.
                </span>
              </span>
              <input type="checkbox" checked={voiceOn} onChange={(event) => setVoiceOn(event.target.checked)} />
            </label>
          ) : (
            <p className="mt-5 text-xs text-navy-400">Spoken voice is included on Pro.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save agent"}
            </button>
            <button
              className="btn-secondary"
              onClick={() =>
                startTransition(async () => {
                  await updateAgent({ status: agent.status === "ACTIVE" ? "PAUSED" : "ACTIVE" });
                })
              }
            >
              {agent.status === "ACTIVE" ? "Pause agent" : "Activate agent"}
            </button>
          </div>
        </div>
        <div className="panel p-6">
          <h3 className="font-display text-lg text-white">What this site can actually do</h3>
          <p className="mt-2 text-sm text-navy-300">Only tools found on this Wix install are shown. Nothing generic is listed.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {agent.capabilities
              .filter((capability) => !presentCapabilities || presentCapabilities.includes(capability.key) || capability.enabled)
              .filter((capability) => {
                if (!presentCapabilities) return true;
                const storeKeys = ["product_recommendations", "product_search", "cart_assistance", "order_tracking", "returns_support"];
                if (storeKeys.includes(capability.key) && !hasStores) return false;
                return true;
              })
              .map((capability) => (
              <label key={capability.id} className="flex items-center justify-between rounded-2xl bg-navy-950/40 px-4 py-3 text-sm">
                <span className="capitalize">{capability.key.replaceAll("_", " ")}</span>
                <input
                  type="checkbox"
                  defaultChecked={capability.enabled}
                  onChange={(event) => {
                    startTransition(async () => {
                      await toggleCapability(capability.id, event.target.checked);
                    });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
        <AgentTeam
          agents={(agents.length ? agents : [agent]).map((row) => ({
            id: row.id,
            name: row.name,
            role: row.role,
            isPrimary: Boolean(row.isPrimary ?? true),
            specialty: row.specialty ?? "GENERAL",
            knowledgeScopes: row.knowledgeScopes ?? [],
            status: row.status,
          }))}
          planKey={planKey}
          hasStores={hasStores}
          hasBookings={hasBookings}
          contentTypes={contentTypes}
        />
      </div>
      <div className="panel overflow-hidden p-4">
        <p className="mb-3 px-2 text-sm text-navy-300">Live widget preview — owner brand, not tidyAgent amber/navy</p>
        <div className="relative min-h-[560px] overflow-hidden rounded-[32px] bg-slate-200">
          <ChatWidget
            name={name}
            greeting={greeting}
            primaryColor={color}
            position={position}
            avatarUrl={avatarUrl}
            preview
            template={template}
            voiceEnabled={voiceOnPlan && voiceOn}
          />
        </div>
      </div>
    </div>
  );
}
