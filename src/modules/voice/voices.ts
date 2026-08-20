import type { AgentSpecialty } from "@prisma/client";

export type AgentVoice = {
  id: string;
  label: string;
  note: string;
  languageCode: string;
  polly: string;
};

export const DEFAULT_VOICE_ID = "en-US-Neural2-F";

export const AGENT_VOICES: AgentVoice[] = [
  { id: "en-US-Neural2-F", label: "Ava", note: "US English · female", languageCode: "en-US", polly: "Joanna" },
  { id: "en-US-Neural2-C", label: "Maya", note: "US English · warm female", languageCode: "en-US", polly: "Kendra" },
  { id: "en-US-Neural2-H", label: "Sofia", note: "US English · bright female", languageCode: "en-US", polly: "Salli" },
  { id: "en-US-Neural2-J", label: "James", note: "US English · male", languageCode: "en-US", polly: "Matthew" },
  { id: "en-US-Neural2-D", label: "Noah", note: "US English · deeper male", languageCode: "en-US", polly: "Joey" },
  { id: "en-GB-Neural2-A", label: "Alice", note: "British English · female", languageCode: "en-GB", polly: "Amy" },
  { id: "en-GB-Neural2-B", label: "Oliver", note: "British English · male", languageCode: "en-GB", polly: "Brian" },
  { id: "en-AU-Neural2-A", label: "Ruby", note: "Australian English · female", languageCode: "en-AU", polly: "Nicole" },
  { id: "en-IN-Neural2-A", label: "Anika", note: "Indian English · female", languageCode: "en-IN", polly: "Aditi" },
];

const SPECIALTY_VOICE: Record<AgentSpecialty, string> = {
  GENERAL: "en-US-Neural2-F",
  ECOMMERCE: "en-US-Neural2-J",
  SUPPORT: "en-US-Neural2-C",
  BOOKINGS: "en-GB-Neural2-A",
  CONTENT: "en-US-Neural2-D",
};

export function resolveVoice(id?: string | null): AgentVoice {
  return AGENT_VOICES.find((item) => item.id === id) ?? AGENT_VOICES[0];
}

export function languageCodeFromVoice(id: string) {
  const match = id.match(/^([a-z]{2}-[A-Z]{2})/);
  return match?.[1] ?? "en-US";
}

/** Prefer a voice that matches the specialty and is not already used on the team. */
export function pickVoiceForAgent(specialty: AgentSpecialty, taken: (string | null | undefined)[]) {
  const used = new Set(taken.filter((item): item is string => Boolean(item)));
  const preferred = SPECIALTY_VOICE[specialty] || DEFAULT_VOICE_ID;
  if (!used.has(preferred)) return preferred;
  return AGENT_VOICES.find((voice) => !used.has(voice.id))?.id ?? preferred;
}
