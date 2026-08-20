import { getAppOrigin } from "@/lib/env";

export function absoluteAvatar(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${getAppOrigin()}${value}`;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

export function personPayload(agent: {
  id: string;
  name: string;
  role?: string | null;
  specialty?: string | null;
  widgetAvatarUrl?: string | null;
  voiceId?: string | null;
}) {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role || "Assistant",
    specialty: agent.specialty || "GENERAL",
    avatarUrl: absoluteAvatar(agent.widgetAvatarUrl),
    voiceId: agent.voiceId || null,
  };
}
