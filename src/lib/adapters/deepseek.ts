import type { LLMService, LLMMessage, LLMResponse, LLMServiceConfig } from "@/lib/types/llm";

export class DeepSeekAdapter implements LLMService {
  private baseUrl = "https://api.deepseek.com";

  async generate(messages: LLMMessage[], config: LLMServiceConfig): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "deepseek-chat",
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    return { text, raw: data };
  }
}
