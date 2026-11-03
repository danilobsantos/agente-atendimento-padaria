export interface LLMToolParameter {
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: LLMToolParameter;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
  _raw?: unknown; // Mantém a estrutura original do provedor (ex: thought_signature do Gemini)
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string; // used when role is "tool"
  name?: string; // used when role is "tool"
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  tool_calls?: LLMToolCall[];
  raw?: unknown;
  usage?: LLMUsage;
}

export interface LLMServiceConfig {
  apiKey: string;
  model: string;
  maxOutputTokens?: number;
  temperature?: number;
  thinkingConfig?: string;
  tools?: LLMTool[];
  responseSchema?: Record<string, unknown>;
  /** AbortSignal para timeout — os adapters repassam ao fetch. */
  signal?: AbortSignal;
}

export interface LLMService {
  generate(messages: LLMMessage[], config: LLMServiceConfig): Promise<LLMResponse>;
}

