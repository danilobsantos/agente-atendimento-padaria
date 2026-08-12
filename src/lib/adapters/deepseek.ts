import type { LLMService, LLMMessage, LLMResponse, LLMServiceConfig } from "@/lib/types/llm";

export class DeepSeekAdapter implements LLMService {
  private baseUrl = "https://api.deepseek.com";

  async generate(messages: LLMMessage[], config: LLMServiceConfig): Promise<LLMResponse> {
    // Map our messages to OpenAI/DeepSeek format
    const formattedMessages = messages.map((m) => {
      const msg: any = {
        role: m.role,
        content: m.content || "",
      };

      if (m.role === "assistant" && m.tool_calls) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        }));
      }

      if (m.role === "tool") {
        msg.tool_call_id = m.tool_call_id;
      }

      return msg;
    });

    const body: any = {
      model: config.model || "deepseek-v4-flash",
      messages: formattedMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxOutputTokens || 4096,
    };

    if (config.tools && config.tools.length > 0) {
      body.tools = config.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      // Remove JSON formatting enforcement when using tools, as we want text or tool calls
    } else {
      // Only enforce JSON if we are not using tools (fallback for old system)
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const text = message?.content ?? "";
    
    let tool_calls = undefined;
    if (message?.tool_calls) {
      tool_calls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    }

    return { text, tool_calls, raw: data };
  }
}

