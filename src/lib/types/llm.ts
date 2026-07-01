export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  text: string;
  raw?: unknown;
}

export interface LLMServiceConfig {
  apiKey: string;
  model: string;
}

export interface LLMService {
  generate(messages: LLMMessage[], config: LLMServiceConfig): Promise<LLMResponse>;
}
