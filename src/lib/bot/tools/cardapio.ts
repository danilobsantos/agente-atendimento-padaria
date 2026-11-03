import type { LLMTool } from "@/lib/types/llm";
import type { SearchProduct } from "@/lib/services/products.service";
import { toolError, type BotTool, type ToolContext, type ToolResult } from "./types";

const DEFINITION: LLMTool = {
  name: "consultar_cardapio",
  description:
    "Consulta interna do cardápio (nomes, variações, complementos e preços) para responder dúvidas específicas. Use ANTES de responder sobre preços, variações ou disponibilidade e antes de montar o campo products. Retorna itens com IDs curtos. IMPORTANTE: os resultados são para SUA pesquisa — nunca liste os itens na mensagem para o cliente.",
  parameters: {
    type: "object",
    properties: {
      busca: { type: "string", description: "Termo de busca no nome do produto (ex: 'pão', 'bolo de fubá')." },
      categoria: { type: "string", description: "Nome da categoria (ex: 'padaria', 'bolos')." },
    },
  },
};

function shortIdFor(ctx: ToolContext, product: SearchProduct): string {
  return ctx.uuidToShort?.get(product.id) ?? product.shortId;
}

async function run(ctx: ToolContext, rawArgs: Record<string, unknown>): Promise<ToolResult> {
  const busca = typeof rawArgs.busca === "string" ? rawArgs.busca : undefined;
  const categoria = typeof rawArgs.categoria === "string" ? rawArgs.categoria : undefined;

  const searchProducts =
    ctx.searchProducts ??
    (async (tenantId: string, opts: { busca?: string; categoria?: string }) => {
      const { ProductsService } = await import("@/lib/services/products.service");
      return ProductsService.searchProducts(tenantId, opts);
    });

  const products = await searchProducts(ctx.tenantId, { busca, categoria });

  if (products.length === 0) {
    // Segunda tentativa com o primeiro token: "bolo de fubá caseiro" costuma
    // falhar inteiro e passar com "bolo".
    const tokens = (busca ?? "").split(/\s+/).filter((t) => t.length >= 3);
    if (tokens.length > 1) {
      const broader = await searchProducts(ctx.tenantId, { busca: tokens[0] });
      if (broader.length > 0) {
        const top = broader.slice(0, 5);
        return {
          ok: true,
          content: `Busca "${busca}" não retornou resultados exatos. Sugestões similares com "${tokens[0]}":\n${top
            .map((p) => `${shortIdFor(ctx, p)}.${p.name} R$${p.price.toFixed(2)}`)
            .join("\n")}`,
          ids: top.map((p) => [shortIdFor(ctx, p), p.id] as [string, string]),
        };
      }
    }
    return toolError(
      "nao_encontrado",
      "Nenhum produto encontrado para essa busca. Peça ao cliente para refinar o termo ou consultar outro item.",
    );
  }

  const lines = products.map((p) => {
    const extras =
      p.extras.length > 0
        ? ` | Complementos: ${p.extras
            .map((e) => `${e.name}(+R$${e.price.toFixed(2)})[id:${e.id}]`)
            .join(", ")}`
        : "";
    return `${shortIdFor(ctx, p)}.${p.name} R$${p.price.toFixed(2)}${extras}`;
  });

  return {
    ok: true,
    content: lines.join("\n"),
    ids: products.map((p) => [shortIdFor(ctx, p), p.id] as [string, string]),
  };
}

export const cardapioTool: BotTool = { definition: DEFINITION, execute: run };
