import type { LLMTool } from "@/lib/types/llm";
import { cardapioTool } from "./cardapio";
import { conhecimentoTool } from "./conhecimento";
import { pedidoAtualTool } from "./pedido-atual";
import { toolError, type BotTool, type ToolContext, type ToolResult } from "./types";

export type { BotTool, ToolContext, ToolResult } from "./types";
export { toolError } from "./types";

/**
 * Registro único de tools do agente. A definição enviada ao modelo e a
 * implementação moram na mesma linha para que não exista tool anunciada sem
 * código (o modelo chamaria e receberia "desconhecida").
 */
export const BOT_TOOLS: readonly BotTool[] = [cardapioTool, conhecimentoTool, pedidoAtualTool];

export const TOOL_DEFINITIONS: LLMTool[] = BOT_TOOLS.map((t) => t.definition);

/** Executa uma tool pelo nome. NUNCA lança — falha vira resultado instrucional. */
export async function executeTool(
  ctx: ToolContext,
  name: string,
  rawArguments: string,
): Promise<ToolResult> {
  const tool = BOT_TOOLS.find((t) => t.definition.name === name);
  if (!tool) {
    return toolError(
      "desconhecida",
      `A ferramenta "${name}" não existe. Use apenas: ${BOT_TOOLS.map((t) => t.definition.name).join(", ")}.`,
    );
  }

  let args: Record<string, unknown> = {};
  if (rawArguments.trim() !== "") {
    try {
      const parsed = JSON.parse(rawArguments);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      return toolError("argumentos_invalidos", "Os argumentos não são um JSON válido. Corrija e chame de novo.");
    }
  }

  try {
    return await tool.execute(ctx, args);
  } catch (err) {
    return toolError("falha_interna", err instanceof Error ? err.message.slice(0, 200) : "erro desconhecido");
  }
}

/** Assinatura para injetar um output previsível em teste. */
export type ToolExecutor = (ctx: ToolContext, name: string, rawArguments: string) => Promise<ToolResult>;
