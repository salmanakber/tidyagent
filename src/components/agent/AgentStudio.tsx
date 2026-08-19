"use client";

import { useState, useTransition } from "react";
import { updateAgent, toggleCapability } from "@/app/actions/workspace";
import { ChatWidget } from "@/components/widget/ChatWidget";
import { AvatarPicker } from "@/components/agent/AvatarPicker";
import { StatusPill } from "@/components/ui/StatusPill";

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
  capabilities: { id: string; key: string; enabled: boolean }[];
};

export function AgentStudio({ agent }: { agent: AgentView }) {
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [personality, setPersonality] = useState(agent.personality);
  const [color, setColor] = useState(agent.widgetPrimaryColor);
  const [greeting, setGreeting] = useState(agent.widgetGreeting);
  const [position, setPosition] = useState(agent.widgetPosition);
  const [avatarUrl, setAvatarUrl] = useState(agent.widgetAvatarUrl ?? null);
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
          <h3 className="font-display text-lg text-white">Capabilities</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {agent.capabilities.map((capability) => (
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
      </div>
      <div className="panel overflow-hidden p-4">
        <p className="mb-3 px-2 text-sm text-navy-300">Live widget preview — owner brand, not tidyAgent amber/navy</p>
        <div className="rounded-[32px] bg-slate-200 p-4">
          <ChatWidget name={name} greeting={greeting} primaryColor={color} position={position} avatarUrl={avatarUrl} preview />
        </div>
      </div>
    </div>
  );
}
