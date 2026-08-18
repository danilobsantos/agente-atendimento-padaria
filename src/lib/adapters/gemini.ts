import type { LLMService, LLMMessage, LLMResponse, LLMServiceConfig } from "@/lib/types/llm";

// Gemini 3.x uses categorical thinkingLevel; 2.5 uses a numeric thinkingBudget.
// Anything else (2.0/1.5/DeepSeek) does not accept thinkingConfig at all.
const GEMINI_3_LEVELS = ["minimal", "low", "medium", "high"];

function thinkingFromConfig(model: string, thinkingConfig?: string): Record<string, unknown> {
  if (!thinkingConfig) return {};
  if (/gemini-3\./.test(model)) {
    return GEMINI_3_LEVELS.includes(thinkingConfig)
      ? { thinkingConfig: { thinkingLevel: thinkingConfig } }
      : {};
  }
  if (/gemini-2\.\d/.test(model)) {
    const budget = Number(thinkingConfig);
    return Number.isFinite(budget) && budget >= -1
      ? { thinkingConfig: { thinkingBudget: budget } }
      : {};
  }
  return {};
}

export class GeminiAdapter implements LLMService {
  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  async generate(messages: LLMMessage[], config: LLMServiceConfig): Promise<LLMResponse> {
    const model = config.model || "gemini-2.0-flash";

    const systemInstruction = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const contents = conversationMessages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "function",
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: { result: msg.content },
              },
            },
          ],
        };
      }

      if (msg.role === "assistant" && msg.tool_calls) {
        return {
          role: "model",
          parts: msg.tool_calls.map((tc) => {
            if (tc._raw) return tc._raw;
            return {
              functionCall: {
                name: tc.name,
                args: JSON.parse(tc.arguments || "{}"),
              },
            };
          }),
        };
      }

      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      };
    });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxOutputTokens || 4096,
        // Force JSON + schema even when tools are present: Gemini supports this and
        // it keeps the final answer schema-shaped (function calls still work).
        responseMimeType: "application/json",
        ...(config.responseSchema && { responseSchema: config.responseSchema }),
        ...thinkingFromConfig(config.model, config.thinkingConfig),
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
    };

    if (config.tools && config.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: config.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    
    // Check if response is a function call
    let tool_calls = undefined;
    const parts = candidate?.content?.parts || [];
    
    const functionCallParts = parts.filter((p: any) => p.functionCall);
    if (functionCallParts.length > 0) {
      tool_calls = functionCallParts.map((p: any) => ({
        id: Math.random().toString(36).substring(7), // Gemini doesn't return tool call IDs
        name: p.functionCall.name,
        arguments: JSON.stringify(p.functionCall.args || {}),
        _raw: p,
      }));
    }

    const textPart = parts.find((p: any) => p.text);
    const text = textPart?.text ?? "";
    
    const finishReason = candidate?.finishReason;

    if (finishReason === "MAX_TOKENS") {
      console.warn(
        `[GeminiAdapter] Response was truncated (finishReason: MAX_TOKENS). Output length: ${text.length} chars. Consider increasing maxOutputTokens or reducing prompt size.`
      );
    }

    return { text, tool_calls, raw: data };
  }
}


