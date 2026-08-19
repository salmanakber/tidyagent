import { describe, expect, it } from "vitest";
import { FailoverAIProvider } from "@/modules/ai/providers";
import type { AIProvider, EmbedResult, GenerateResult } from "@/modules/ai/provider";

class FakeProvider implements AIProvider {
  constructor(
    readonly id: string,
    private readonly shouldFail: boolean,
    private readonly label: string,
  ) {}

  async generate(): Promise<GenerateResult> {
    if (this.shouldFail) throw new Error(`${this.id} down`);
    return { text: this.label, model: this.id, provider: this.id };
  }

  async embed(): Promise<EmbedResult> {
    throw new Error("no embed");
  }
}

describe("AI failover", () => {
  it("uses the next provider when the first fails", async () => {
    const ai = new FailoverAIProvider([
      new FakeProvider("gemini", true, "gemini"),
      new FakeProvider("groq", false, "groq-ok"),
      new FakeProvider("openai", false, "openai-ok"),
    ]);
    const result = await ai.generate({ system: "", prompt: "hi" });
    expect(result.provider).toBe("groq");
    expect(result.text).toBe("groq-ok");
  });

  it("tries the third provider if the first two fail", async () => {
    const ai = new FailoverAIProvider([
      new FakeProvider("gemini", true, "gemini"),
      new FakeProvider("groq", true, "groq"),
      new FakeProvider("openai", false, "openai-ok"),
    ]);
    const result = await ai.generate({ system: "", prompt: "hi" });
    expect(result.provider).toBe("openai");
  });
});
