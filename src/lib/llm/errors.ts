export type LlmErrorCode =
  | "rate_limited"
  | "invalid_key"
  | "overloaded"
  | "bad_request"
  | "timeout"
  | "unknown";

/**
 * Erro do provedor com vocabulário estável. O mesmo 401 não pode aparecer como
 * três coisas diferentes em três telas — o operador precisa do mesmo nome para
 * procurar o mesmo problema.
 */
export class LlmProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly code: LlmErrorCode,
    readonly httpStatus: number | undefined,
    message: string,
  ) {
    super(`[${provider}:${code}] ${message}`);
    this.name = "LlmProviderError";
  }
}

export function toLlmError(provider: string, status: number, body: string): LlmProviderError {
  const detail = body.slice(0, 300);
  if (status === 401 || status === 403) return new LlmProviderError(provider, "invalid_key", status, detail);
  if (status === 429) return new LlmProviderError(provider, "rate_limited", status, detail);
  if (status >= 500) return new LlmProviderError(provider, "overloaded", status, detail);
  if (status >= 400) return new LlmProviderError(provider, "bad_request", status, detail);
  return new LlmProviderError(provider, "unknown", status, detail);
}

export function describeLlmError(error: unknown): { code: LlmErrorCode; message: string } {
  if (error instanceof LlmProviderError) return { code: error.code, message: error.message };
  if (error instanceof Error) {
    if (error.name === "AbortError") return { code: "timeout", message: "chamada abortada por timeout" };
    return { code: "unknown", message: error.message.slice(0, 300) };
  }
  return { code: "unknown", message: String(error).slice(0, 300) };
}
