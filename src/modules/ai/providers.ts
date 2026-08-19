import {
  AIProviderNotConfiguredError,
  type AIProvider,
  type EmbedInput,
  type EmbedResult,
  type GenerateInput,
  type GenerateResult,
} from "@/modules/ai/provider";
import { modelFallbacks, type AIProviderId } from "@/modules/ai/models";

async function errorDetail(response: Response) {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || raw.slice(0, 180);
  } catch {
    return raw.slice(0, 180) || response.statusText;
  }
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";

  constructor(
    private apiKey: string,
    private model = "gemini-2.5-flash",
  ) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    if (!this.apiKey) throw new AIProviderNotConfiguredError("gemini");

    const errors: string[] = [];
    for (const model of modelFallbacks("gemini", this.model)) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.system }] },
            contents: [{ role: "user", parts: [{ text: input.prompt }] }],
            generationConfig: {
              temperature: input.temperature ?? 0.3,
              maxOutputTokens: input.maxTokens ?? 1024,
            },
          }),
        },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };
        return {
          text: data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "",
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
          model,
          provider: this.id,
        };
      }

      const detail = await errorDetail(response);
      errors.push(`${model}: ${response.status} ${detail}`);
      if (response.status !== 404) break;
    }

    throw new Error(`Gemini generate failed. ${errors.join(" | ")}`);
  }

  async embed(input: EmbedInput): Promise<EmbedResult> {
    if (!this.apiKey) throw new AIProviderNotConfiguredError("gemini");
    const models = ["text-embedding-004", "gemini-embedding-001"];
    const errors: string[] = [];
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: input.texts.map((text) => ({
              model: `models/${model}`,
              content: { parts: [{ text }] },
            })),
          }),
        },
      );
      if (response.ok) {
        const data = (await response.json()) as { embeddings?: { values: number[] }[] };
        return {
          embeddings: data.embeddings?.map((item) => item.values) ?? [],
          model,
          provider: this.id,
        };
      }
      errors.push(`${model}: ${response.status} ${await errorDetail(response)}`);
      if (response.status !== 404) break;
    }
    throw new Error(`Gemini embed failed. ${errors.join(" | ")}`);
  }
}

export class GroqProvider implements AIProvider {
  readonly id = "groq";

  constructor(
    private apiKey: string,
    private model = "llama-3.1-8b-instant",
  ) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    if (!this.apiKey) throw new AIProviderNotConfiguredError("groq");

    const errors: string[] = [];
    for (const model of modelFallbacks("groq", this.model)) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxTokens ?? 1024,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        return {
          text: data.choices?.[0]?.message?.content ?? "",
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          model,
          provider: this.id,
        };
      }

      const detail = await errorDetail(response);
      errors.push(`${model}: ${response.status} ${detail}`);
      if (response.status !== 404) break;
    }

    throw new Error(`Groq generate failed. ${errors.join(" | ")}`);
  }

  async embed(): Promise<EmbedResult> {
    throw new AIProviderNotConfiguredError("groq-embeddings");
  }
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";

  constructor(
    private apiKey: string,
    private model = "gpt-4o-mini",
  ) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    if (!this.apiKey) throw new AIProviderNotConfiguredError("openai");
    const errors: string[] = [];
    for (const model of modelFallbacks("openai", this.model)) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxTokens ?? 1024,
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.prompt },
          ],
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        return {
          text: data.choices?.[0]?.message?.content ?? "",
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          model,
          provider: this.id,
        };
      }
      const detail = await errorDetail(response);
      errors.push(`${model}: ${response.status} ${detail}`);
      if (response.status !== 404) break;
    }
    throw new Error(`OpenAI generate failed. ${errors.join(" | ")}`);
  }

  async embed(input: EmbedInput): Promise<EmbedResult> {
    if (!this.apiKey) throw new AIProviderNotConfiguredError("openai");
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        dimensions: 768,
        input: input.texts,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI embed failed: ${response.status} ${await errorDetail(response)}`);
    const data = (await response.json()) as { data?: { embedding: number[] }[] };
    return {
      embeddings: data.data?.map((item) => item.embedding) ?? [],
      model: "text-embedding-3-small",
      provider: this.id,
    };
  }
}

export class FailoverAIProvider implements AIProvider {
  readonly id = "failover";

  constructor(private providers: AIProvider[]) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        return await provider.generate(input);
      } catch (error) {
        errors.push(`${provider.id}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
  }

  async embed(input: EmbedInput): Promise<EmbedResult> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        return await provider.embed(input);
      } catch (error) {
        errors.push(`${provider.id}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    throw new Error(`All embedding providers failed. ${errors.join(" | ")}`);
  }
}
