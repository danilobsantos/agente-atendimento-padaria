import type { LLMTool } from "@/lib/types/llm";
import type { BotSession } from "@/lib/types/session";
import type { SearchProduct } from "@/lib/services/products.service";

/**
 * Contrato de tool do agente.
 *
 * - O contexto (tenant/customer) vem do CLOSURE do turno, nunca do payload do
 *   modelo: um `tenantId` vindo do modelo seria uma porta entre tenants.
 * - `execute` NUNCA lança. Falha vira `{ok:false}` com mensagem instrucional —
 *   uma exceção mataria o turno e o cliente ficaria sem resposta no meio da
 *   conversa.
 */
export interface ToolContext {
  tenantId: string;
  customerId: string;
  session: BotSession;
  /** Mapa UUID → ID curto do catálogo completo do turno. */
  uuidToShort?: Map<string, string>;
  /** Injeção para teste; default usa ProductsService. */
  searchProducts?: (
    tenantId: string,
    opts: { busca?: string; categoria?: string },
  ) => Promise<SearchProduct[]>;
}

export interface ToolResult {
  ok: boolean;
  content: string;
  /** Pares [idCurto, uuid] descobertos nesta chamada, para resolver o carrinho. */
  ids?: [string, string][];
}

export interface BotTool {
  definition: LLMTool;
  execute(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>;
}

export function toolError(code: string, message: string): ToolResult {
  return { ok: false, content: `erro (${code}): ${message}` };
}
