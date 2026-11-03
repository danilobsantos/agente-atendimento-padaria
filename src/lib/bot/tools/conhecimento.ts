import type { LLMTool } from "@/lib/types/llm";
import { KnowledgeService } from "@/lib/services/knowledge.service";
import { toolError, type BotTool, type ToolContext, type ToolResult } from "./types";

const DEFINITION: LLMTool = {
  name: "consultar_conhecimento",
  description:
    "Consulta as regras do negócio e a FAQ da padaria: horário de funcionamento, taxa e área de entrega, formas de pagamento, valor mínimo, prazo, cancelamento, endereço e telefone. Use SEMPRE que o cliente perguntar algo que não seja item do cardápio. Se não encontrar, NÃO invente: diga que vai confirmar com a equipe.",
  parameters: {
    type: "object",
    properties: {
      pergunta: { type: "string", description: "A dúvida do cliente, nas palavras dele." },
    },
    required: ["pergunta"],
  },
};

async function run(ctx: ToolContext, rawArgs: Record<string, unknown>): Promise<ToolResult> {
  const pergunta = typeof rawArgs.pergunta === "string" ? rawArgs.pergunta.trim() : "";
  if (!pergunta) {
    return toolError("pergunta_vazia", "Informe a pergunta do cliente no campo 'pergunta'.");
  }

  const hits = await KnowledgeService.search(ctx.tenantId, pergunta);
  if (hits.length === 0) {
    return toolError(
      "nao_encontrado",
      "Nada cadastrado sobre isso. Responda que vai confirmar com a equipe e siga a conversa — não invente prazo, taxa ou política.",
    );
  }

  return {
    ok: true,
    content: hits.map((h) => `Q: ${h.question}\nR: ${h.answer}`).join("\n\n"),
  };
}

export const conhecimentoTool: BotTool = { definition: DEFINITION, execute: run };
