/**
 * Seam único de chamada de LLM.
 *
 * Duas regras herdadas do DeskcommCRM:
 *  1. Toda chamada deixa uma linha em `llm_calls` — inclusive (principalmente) a
 *     que falhou. A tabela que deveria explicar não pode ficar vazia no caso que
 *     precisa de explicação.
 *  2. O gate de orçamento roda ANTES do primeiro byte e **falha aberto** se a
 *     leitura do gasto falhar: o cliente não pode perder o bot porque uma query
 *     deu timeout.
 */
import { prisma } from "@/lib/prisma";
import type { LLMMessage, LLMResponse, LLMService, LLMServiceConfig } from "@/lib/types/llm";
import { describeLlmError, LlmProviderError } from "./errors";

const DEFAULT_TIMEOUT_MS = 45_000;

export class LlmBudgetExceededError extends Error {
  constructor(readonly spentCents: number, readonly budgetCents: number) {
    super(`orçamento mensal de IA estourado (${spentCents}/${budgetCents} centavos)`);
    this.name = "LlmBudgetExceededError";
  }
}

/**
 * Preço por 1M de tokens, em centavos de dólar, indexado por FAMÍLIA de modelo.
 * Modelos fora da tabela devolvem `null`: contar como 0 mentiria "de graça" e
 * faria o teto de gasto parecer saudável enquanto a fatura cresce.
 */
const PRICE_PER_MTOK: ReadonlyArray<{ prefix: string; input: number; output: number }> = [
  { prefix: "deepseek", input: 27, output: 110 },
  { prefix: "gemini", input: 30, output: 250 },
];

export function estimateCostCents(
  model: string,
  usage: { inputTokens: number; outputTokens: number } | undefined,
): number | null {
  if (!usage) return null;
  const row = PRICE_PER_MTOK.find((p) => model.toLowerCase().startsWith(p.prefix));
  if (!row) return null;
  const cents = (usage.inputTokens * row.input + usage.outputTokens * row.output) / 1_000_000;
  // 4 casas: um turno típico custa ~0,15 centavo. Arredondar para inteiro
  // registraria zero e o teto de gasto nunca dispararia.
  return Math.round(cents * 10_000) / 10_000;
}

/** Gasto do mês corrente em centavos de dólar. `null` = não deu para medir. */
export async function monthlySpendCents(tenantId: string): Promise<number | null> {
  try {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { _sum } = await prisma.llmCall.aggregate({
      where: { tenantId, createdAt: { gte: start }, status: "ok" },
      _sum: { costCents: true },
    });
    return _sum.costCents ?? 0;
  } catch (err) {
    console.warn("[llm] não foi possível medir o gasto do mês:", err);
    return null;
  }
}

export async function assertBudget(tenantId: string): Promise<void> {
  let budgetCents = 0;
  try {
    const settings = await prisma.botSetting.findUnique({
      where: { tenantId },
      select: { monthlyBudgetCents: true },
    });
    budgetCents = settings?.monthlyBudgetCents ?? 0;
  } catch {
    return; // fail-open
  }
  if (budgetCents <= 0) return;
  const spent = await monthlySpendCents(tenantId);
  if (spent === null) return; // fail-open
  if (spent >= budgetCents) throw new LlmBudgetExceededError(spent, budgetCents);
}

export interface RunLlmArgs {
  tenantId: string;
  customerId?: string;
  purpose?: string;
  service: LLMService;
  messages: LLMMessage[];
  config: LLMServiceConfig;
  /** Id do provedor para a linha de telemetria (DEEPSEEK, GEMINI…). */
  provider: string;
  timeoutMs?: number;
  /** 1 retry automático em 429/5xx/timeout. Nunca em erro de chave ou 400. */
  retries?: number;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof LlmProviderError) {
    return error.code === "rate_limited" || error.code === "overloaded";
  }
  return error instanceof Error && error.name === "AbortError";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLlm(args: RunLlmArgs): Promise<LLMResponse> {
  const retries = args.retries ?? 1;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const purpose = args.purpose ?? "agent_turn";

  await assertBudget(args.tenantId);

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const startedAt = Date.now();
    try {
      const response = await args.service.generate(args.messages, {
        ...args.config,
        signal: AbortSignal.timeout(timeoutMs),
      });
      await logCall(args, purpose, response, Date.now() - startedAt, "ok", null);
      return response;
    } catch (error) {
      lastError = error;
      const { code } = describeLlmError(error);
      await logCall(args, purpose, null, Date.now() - startedAt, "error", code);
      if (attempt < retries && isRetryable(error)) {
        attempt += 1;
        await sleep(500 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

async function logCall(
  args: RunLlmArgs,
  purpose: string,
  response: LLMResponse | null,
  latencyMs: number,
  status: "ok" | "error",
  errorCode: string | null,
): Promise<void> {
  try {
    const usage = response?.usage;
    const costCents = estimateCostCents(args.config.model, usage);
    await prisma.llmCall.create({
      data: {
        tenantId: args.tenantId,
        customerId: args.customerId ?? null,
        provider: args.provider,
        model: args.config.model,
        purpose,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        latencyMs,
        status,
        errorCode,
        costCents,
      },
    });
  } catch (err) {
    // Telemetria perdida é infinitamente melhor que resposta perdida.
    console.warn("[llm] chamada não registrada em llm_calls:", err);
  }
}
