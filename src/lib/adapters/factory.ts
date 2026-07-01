import type { LLMService } from "@/lib/types/llm";
import { DeepSeekAdapter } from "@/lib/adapters/deepseek";
import { GeminiAdapter } from "@/lib/adapters/gemini";
import type { LLMProvider } from "@/generated/prisma/client";

const adapters: Record<LLMProvider, () => LLMService> = {
  DEEPSEEK: () => new DeepSeekAdapter(),
  GEMINI: () => new GeminiAdapter(),
  OPENAI: () => new DeepSeekAdapter(), // OpenAI-compatible format (same as DeepSeek)
};

export function createLLMService(provider: LLMProvider): LLMService {
  const factory = adapters[provider];
  if (!factory) {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
  return factory();
}
