export type GenerateInput = {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type GenerateResult = {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  provider: string;
};

export type EmbedInput = {
  texts: string[];
};

export type EmbedResult = {
  embeddings: number[][];
  model: string;
  provider: string;
};

/**
 * Business logic must depend on this interface, never a specific SDK.
 * Phase 1: interface + a single real provider. No speculative failover.
 */
export interface AIProvider {
  readonly id: string;
  generate(input: GenerateInput): Promise<GenerateResult>;
  embed(input: EmbedInput): Promise<EmbedResult>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured`);
    this.name = "AIProviderNotConfiguredError";
  }
}
