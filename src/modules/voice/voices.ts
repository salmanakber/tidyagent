import type { AgentSpecialty } from "@prisma/client";

export type AgentVoice = {
  id: string;
  label: string;
  note: string;
  languageCode: string;
  region: string;
  polly: string;
};

export const DEFAULT_VOICE_ID = "en-US-Neural2-F";

export const AGENT_VOICES: AgentVoice[] = [
  { id: "en-US-Neural2-F", label: "Ava", note: "US · female, clear", languageCode: "en-US", region: "United States", polly: "Joanna" },
  { id: "en-US-Neural2-C", label: "Maya", note: "US · female, warm", languageCode: "en-US", region: "United States", polly: "Kendra" },
  { id: "en-US-Neural2-H", label: "Sofia", note: "US · female, bright", languageCode: "en-US", region: "United States", polly: "Salli" },
  { id: "en-US-Neural2-A", label: "Lena", note: "US · female, soft", languageCode: "en-US", region: "United States", polly: "Kimberly" },
  { id: "en-US-Neural2-E", label: "Chloe", note: "US · female, young", languageCode: "en-US", region: "United States", polly: "Ivy" },
  { id: "en-US-Neural2-G", label: "Harper", note: "US · female, news", languageCode: "en-US", region: "United States", polly: "Joanna" },
  { id: "en-US-Neural2-J", label: "James", note: "US · male, confident", languageCode: "en-US", region: "United States", polly: "Matthew" },
  { id: "en-US-Neural2-D", label: "Noah", note: "US · male, deeper", languageCode: "en-US", region: "United States", polly: "Joey" },
  { id: "en-US-Neural2-I", label: "Owen", note: "US · male, calm", languageCode: "en-US", region: "United States", polly: "Justin" },
  { id: "en-US-Studio-O", label: "Studio Ava", note: "US · studio female", languageCode: "en-US", region: "United States", polly: "Joanna" },
  { id: "en-US-Studio-Q", label: "Studio James", note: "US · studio male", languageCode: "en-US", region: "United States", polly: "Matthew" },
  { id: "en-US-Journey-F", label: "Journey Ava", note: "US · assistant female", languageCode: "en-US", region: "United States", polly: "Joanna" },
  { id: "en-US-Journey-D", label: "Journey James", note: "US · assistant male", languageCode: "en-US", region: "United States", polly: "Matthew" },
  { id: "en-US-Journey-O", label: "Journey Maya", note: "US · assistant warm", languageCode: "en-US", region: "United States", polly: "Kendra" },
  { id: "en-GB-Neural2-A", label: "Alice", note: "British · female", languageCode: "en-GB", region: "United Kingdom", polly: "Amy" },
  { id: "en-GB-Neural2-C", label: "Charlotte", note: "British · female, warm", languageCode: "en-GB", region: "United Kingdom", polly: "Emma" },
  { id: "en-GB-Neural2-F", label: "Emily", note: "British · female, bright", languageCode: "en-GB", region: "United Kingdom", polly: "Amy" },
  { id: "en-GB-Neural2-B", label: "Oliver", note: "British · male", languageCode: "en-GB", region: "United Kingdom", polly: "Brian" },
  { id: "en-GB-Neural2-D", label: "Henry", note: "British · male, deeper", languageCode: "en-GB", region: "United Kingdom", polly: "Arthur" },
  { id: "en-AU-Neural2-A", label: "Ruby", note: "Australian · female", languageCode: "en-AU", region: "Australia", polly: "Nicole" },
  { id: "en-AU-Neural2-C", label: "Isla", note: "Australian · female, warm", languageCode: "en-AU", region: "Australia", polly: "Olivia" },
  { id: "en-AU-Neural2-B", label: "Jack", note: "Australian · male", languageCode: "en-AU", region: "Australia", polly: "Russell" },
  { id: "en-AU-Neural2-D", label: "Liam", note: "Australian · male, calm", languageCode: "en-AU", region: "Australia", polly: "Russell" },
  { id: "en-IN-Neural2-A", label: "Anika", note: "Indian English · female", languageCode: "en-IN", region: "India", polly: "Aditi" },
  { id: "en-IN-Neural2-D", label: "Priya", note: "Indian English · female, bright", languageCode: "en-IN", region: "India", polly: "Raveena" },
  { id: "en-IN-Neural2-B", label: "Arjun", note: "Indian English · male", languageCode: "en-IN", region: "India", polly: "Aditi" },
  { id: "en-IN-Neural2-C", label: "Rohan", note: "Indian English · male, calm", languageCode: "en-IN", region: "India", polly: "Aditi" },
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

export function voicesByRegion() {
  const groups: { region: string; voices: AgentVoice[] }[] = [];
  for (const voice of AGENT_VOICES) {
    const existing = groups.find((group) => group.region === voice.region);
    if (existing) existing.voices.push(voice);
    else groups.push({ region: voice.region, voices: [voice] });
  }
  return groups;
}
