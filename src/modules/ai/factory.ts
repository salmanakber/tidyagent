import { getAIRuntimeConfig, type AIProviderId } from "@/lib/security/settings";
import type { AIProvider } from "@/modules/ai/provider";
import { FailoverAIProvider, GeminiProvider, GroqProvider, OpenAIProvider } from "@/modules/ai/providers";

function buildProvider(
  id: AIProviderId,
  keys: { gemini: string; groq: string; openai: string },
  models: { gemini: string; groq: string; openai: string },
): AIProvider | null {
  if (id === "gemini" && keys.gemini) return new GeminiProvider(keys.gemini, models.gemini);
  if (id === "groq" && keys.groq) return new GroqProvider(keys.groq, models.groq);
  if (id === "openai" && keys.openai) return new OpenAIProvider(keys.openai, models.openai);
  return null;
}

export async function getAIProvider(): Promise<AIProvider> {
  const config = await getAIRuntimeConfig();
  const chain = config.order
    .map((id) => buildProvider(id, config.keys, config.models))
    .filter((provider): provider is AIProvider => Boolean(provider));

  if (chain.length === 0) {
    return new GeminiProvider("");
  }

  if (!config.failoverEnabled || chain.length === 1) {
    return chain[0]!;
  }

  return new FailoverAIProvider(chain);
}

export async function listConfiguredProviders() {
  const config = await getAIRuntimeConfig();
  return config.order.map((id) => ({
    id,
    configured: Boolean(config.keys[id]),
  }));
}
