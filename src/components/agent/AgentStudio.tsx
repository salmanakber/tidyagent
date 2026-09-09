"use client";

import { useState, useTransition } from "react";
import { updateAgent, toggleCapability } from "@/app/actions/workspace";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { AvatarPicker } from "@/components/agent/AvatarPicker";
import { AgentTeam } from "@/components/agent/AgentTeam";
import { StatusPill } from "@/components/ui/StatusPill";
import { WIDGET_TEMPLATES } from "@/modules/agents/team";
import { VoiceSelect, VoiceTestButton } from "@/components/voice/VoiceTestButton";
import { DEFAULT_VOICE_ID } from "@/modules/voice/voices";
import { GRADIENT_ANGLES, type GradientAngle } from "@/modules/widget/gradient";
import type { AgentSpecialty, KnowledgeContentType, PlanKey, WidgetTemplate } from "@prisma/client";
import { cn } from "@/lib/utils";

type AgentView = {
  id: string;
  name: string;
  role: string;
  personality: string;
  status: string;
  widgetPrimaryColor: string;
  widgetUseGradient?: boolean;
  widgetGradientTo?: string;
  widgetGradientAngle?: GradientAngle | string;
  widgetTextColor?: string;
  widgetMessageColor?: string;
  widgetGreeting: string;
  widgetPosition: "BOTTOM_RIGHT" | "BOTTOM_LEFT";
  widgetEmbedMode: "AUTO" | "MANUAL";
  widgetAvatarUrl?: string | null;
  widgetTemplate?: WidgetTemplate;
  voiceEnabled?: boolean;
  voiceId?: string | null;
  isPrimary?: boolean;
  specialty?: AgentSpecialty;
  knowledgeScopes?: string[];
  capabilities: { id: string; key: string; enabled: boolean }[];
};

const TABS = [
  { id: "identity", label: "Identity" },
  { id: "look", label: "Look" },
  { id: "voice", label: "Voice" },
  { id: "tools", label: "Tools" },
  { id: "team", label: "Team" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AgentStudio({
  agent,
  agents = [],
  planKey = "STARTER",
  voiceOnPlan = false,
  allTemplates = false,
  maxAgents = 1,
  hasStores = false,
  hasBookings = false,
  hasBlog = false,
  hasEvents = false,
  contentTypes = ["PAGE", "FAQ", "POLICY", "CUSTOM"],
  presentCapabilities,
  platformLabel = "Wix",
  whatsappDigits,
  humanName,
}: {
  agent: AgentView;
  agents?: AgentView[];
  planKey?: PlanKey;
  voiceOnPlan?: boolean;
  allTemplates?: boolean;
  maxAgents?: number;
  hasStores?: boolean;
  hasBookings?: boolean;
  hasBlog?: boolean;
  hasEvents?: boolean;
  contentTypes?: KnowledgeContentType[];
  presentCapabilities?: string[];
  platformLabel?: string;
  whatsappDigits?: string | null;
  humanName?: string | null;
}) {
  const [tab, setTab] = useState<TabId>("identity");
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [personality, setPersonality] = useState(agent.personality);
  const [color, setColor] = useState(agent.widgetPrimaryColor);
  const [useGradient, setUseGradient] = useState(Boolean(agent.widgetUseGradient));
  const [gradientTo, setGradientTo] = useState(agent.widgetGradientTo || "#4F8CFF");
  const [gradientAngle, setGradientAngle] = useState<GradientAngle>(
    GRADIENT_ANGLES.some((item) => item.id === agent.widgetGradientAngle)
      ? (agent.widgetGradientAngle as GradientAngle)
      : "to-bottom-right",
  );
  const [textColor, setTextColor] = useState(agent.widgetTextColor || "#FFFFFF");
  const [messageColor, setMessageColor] = useState(agent.widgetMessageColor || "#1E293B");
  const [greeting, setGreeting] = useState(agent.widgetGreeting);
  const [position, setPosition] = useState(agent.widgetPosition);
  const [avatarUrl, setAvatarUrl] = useState(agent.widgetAvatarUrl ?? null);
  const [template, setTemplate] = useState<WidgetTemplate>(agent.widgetTemplate ?? "CLASSIC");
  const [voiceOn, setVoiceOn] = useState(Boolean(agent.voiceEnabled));
  const [voiceId, setVoiceId] = useState(agent.voiceId || DEFAULT_VOICE_ID);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setError(null);
      try {
        await updateAgent({
          agentId: agent.id,
          name,
          role,
          personality: personality as "friendly" | "professional" | "casual" | "custom",
          widgetPrimaryColor: color,
          widgetUseGradient: useGradient,
          widgetGradientTo: gradientTo,
          widgetGradientAngle: gradientAngle,
          widgetTextColor: textColor,
          widgetMessageColor: messageColor,
          widgetGreeting: greeting,
          widgetPosition: position,
          widgetAvatarUrl: avatarUrl ?? "",
          widgetTemplate: template,
          ...(voiceOnPlan ? { voiceEnabled: voiceOn, voiceId } : { voiceEnabled: false }),
        });
      } catch (caught) {
        setError(caught instanceof Error ? "Could not save. Please try again." : "Could not save.");
      }
    });
  }

  function saveAvatar(url: string | null) {
    setAvatarUrl(url);
    startTransition(async () => {
      await updateAgent({ agentId: agent.id, widgetAvatarUrl: url ?? "" });
    });
  }

  const tools = agent.capabilities
    .filter((capability) => !presentCapabilities || presentCapabilities.includes(capability.key) || capability.enabled)
    .filter((capability) => {
      if (!presentCapabilities) return true;
      const storeKeys = ["product_recommendations", "product_search", "cart_assistance", "order_tracking", "returns_support"];
      if (storeKeys.includes(capability.key) && !hasStores) return false;
      return true;
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-300">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl text-white">{name}</h2>
              <p className="truncate text-xs text-navy-400">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={agent.status} />
            <button className="btn-primary px-3 py-2 text-xs" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-sm transition",
                tab === item.id ? "bg-amber-500/15 text-amber-300" : "text-navy-300 hover:bg-white/5 hover:text-white",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="max-h-[min(62dvh,640px)] overflow-y-auto p-5">
          {tab === "identity" ? (
            <div className="space-y-4">
              <AvatarPicker name={name} url={avatarUrl} onChange={saveAvatar} />
              <div className="grid gap-3 sm:grid-cols-2">
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
                <label className="text-sm text-navy-300 sm:col-span-2">
                  Greeting
                  <input className="field mt-2" value={greeting} onChange={(event) => setGreeting(event.target.value)} />
                </label>
              </div>
              <button
                className="btn-secondary"
                onClick={() =>
                  startTransition(async () => {
                    await updateAgent({ agentId: agent.id, status: agent.status === "ACTIVE" ? "PAUSED" : "ACTIVE" });
                  })
                }
              >
                {agent.status === "ACTIVE" ? "Pause agent" : "Activate agent"}
              </button>
            </div>
          ) : null}

          {tab === "look" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ColorField label="Widget color" value={color} onChange={setColor} />
                <ColorField label="Header & bubble text" value={textColor} onChange={setTextColor} />
                <ColorField label="Message text" value={messageColor} onChange={setMessageColor} />
                <label className="text-sm text-navy-300">
                  Position
                  <select className="field mt-2" value={position} onChange={(event) => setPosition(event.target.value as typeof position)}>
                    <option value="BOTTOM_RIGHT">Bottom right</option>
                    <option value="BOTTOM_LEFT">Bottom left</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center justify-between rounded-2xl bg-navy-950/40 px-4 py-3 text-sm">
                <span>
                  <span className="block text-white">Gradient</span>
                  <span className="text-xs text-navy-400">Blend header, bubbles, and send button.</span>
                </span>
                <input type="checkbox" checked={useGradient} onChange={(event) => setUseGradient(event.target.checked)} />
              </label>
              {useGradient ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField label="Second color" value={gradientTo} onChange={setGradientTo} />
                  <label className="text-sm text-navy-300">
                    Direction
                    <select
                      className="field mt-2"
                      value={gradientAngle}
                      onChange={(event) => setGradientAngle(event.target.value as GradientAngle)}
                    >
                      {GRADIENT_ANGLES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div>
                <p className="text-sm text-navy-300">Chat template</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {WIDGET_TEMPLATES.map((item) => {
                    const locked = !allTemplates && item.key !== "CLASSIC";
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          if (!locked) setTemplate(item.key);
                        }}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left",
                          template === item.key ? "border-amber-400/40 bg-amber-500/10" : "border-white/10",
                          locked && "opacity-50",
                        )}
                      >
                        <p className="text-sm text-white">{item.label}</p>
                        <p className="mt-1 text-xs text-navy-400">{locked ? "Business and Pro" : item.note}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "voice" ? (
            voiceOnPlan ? (
              <div className="space-y-4">
                <label className="flex items-center justify-between rounded-2xl bg-navy-950/40 px-4 py-3 text-sm">
                  <span>
                    <span className="block text-white">Spoken replies</span>
                    <span className="text-xs text-navy-400">Visitors hear this voice. Mic still uses their browser.</span>
                  </span>
                  <input type="checkbox" checked={voiceOn} onChange={(event) => setVoiceOn(event.target.checked)} />
                </label>
                {voiceOn ? (
                  <div>
                    <p className="text-sm text-navy-300">Voice for {name}</p>
                    <VoiceSelect value={voiceId} onChange={setVoiceId} />
                    <div className="mt-3">
                      <VoiceTestButton
                        preview
                        voiceId={voiceId}
                        sample={`Hi, I’m ${name}. If you can hear this, this is the voice visitors will get.`}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-navy-300">Spoken voice is included on Pro.</p>
            )
          ) : null}

          {tab === "tools" ? (
            <div>
              <p className="text-sm text-navy-300">Only tools found on this {platformLabel} install are shown.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {tools.map((capability) => (
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
          ) : null}

          {tab === "team" ? (
            <AgentTeam
              agents={(agents.length ? agents : [agent]).map((row) => ({
                id: row.id,
                name: row.name,
                role: row.role,
                isPrimary: Boolean(row.isPrimary ?? true),
                specialty: row.specialty ?? "GENERAL",
                knowledgeScopes: row.knowledgeScopes ?? [],
                status: row.status,
                widgetAvatarUrl: row.widgetAvatarUrl,
                voiceId: row.voiceId,
              }))}
              planKey={planKey}
              maxAgents={maxAgents}
              voiceOnPlan={voiceOnPlan}
              hasStores={hasStores}
              hasBookings={hasBookings}
              hasBlog={hasBlog}
              hasEvents={hasEvents}
              contentTypes={contentTypes}
              platformLabel={platformLabel}
            />
          ) : null}

          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>

      <aside className="panel sticky top-20 self-start overflow-hidden p-4">
        <p className="mb-3 px-1 text-sm text-navy-300">Live preview</p>
        <div className="relative min-h-[520px] overflow-hidden rounded-[28px] bg-slate-200">
          <ChatWidget
            name={name}
            greeting={greeting}
            primaryColor={color}
            useGradient={useGradient}
            gradientTo={gradientTo}
            gradientAngle={gradientAngle}
            textColor={textColor}
            messageColor={messageColor}
            position={position}
            avatarUrl={avatarUrl}
            preview
            template={template}
            voiceEnabled={voiceOnPlan && voiceOn}
            voiceId={voiceId}
            whatsappDigits={whatsappDigits}
            humanName={humanName}
          />
        </div>
      </aside>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-navy-300">
      {label}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          className="h-11 w-12 cursor-pointer rounded-xl border border-white/10 bg-transparent p-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input className="field" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}
