export type AIProviderId = "gemini" | "groq" | "openai";

export type ModelOption = {
  id: string;
  label: string;
  note: string;
};

export const GEMINI_MODELS: ModelOption[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "Free-tier default · fast" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", note: "Free · cheapest / fastest" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", note: "Free · current lite" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", note: "Free-tier capable" },
];

export const GROQ_MODELS: ModelOption[] = [
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", note: "Free · fastest" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", note: "Free · better quality" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "Free on Groq" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", note: "Free · preview" },
];

export const OPENAI_MODELS: ModelOption[] = [
  { id: "gpt-4o-mini", label: "GPT-4o mini", note: "Paid · cheap" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", note: "Paid" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 nano", note: "Paid · cheapest" },
];

export const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
} as const;

export function modelFallbacks(provider: AIProviderId, selected: string) {
  const catalog =
    provider === "gemini" ? GEMINI_MODELS : provider === "groq" ? GROQ_MODELS : OPENAI_MODELS;
  const ids = catalog.map((item) => item.id);
  return [selected, ...ids.filter((id) => id !== selected)];
}
