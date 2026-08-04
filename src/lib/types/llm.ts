export interface LLMToolParameter {
  type: string;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
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
  _raw?: any; // Mantém a estrutura original do provedor (ex: thought_signature do Gemini)
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string; // used when role is "tool"
  name?: string; // used when role is "tool"
}

export interface LLMResponse {
  text: string;
  tool_calls?: LLMToolCall[];
  raw?: unknown;
}

export interface LLMServiceConfig {
  apiKey: string;
  model: string;
  maxOutputTokens?: number;
  temperature?: number;
  tools?: LLMTool[];
  responseSchema?: Record<string, unknown>;
}

export interface LLMService {
  generate(messages: LLMMessage[], config: LLMServiceConfig): Promise<LLMResponse>;
}

