import type { LLMTool } from "@/lib/types/llm";
import type { BotTool, ToolContext, ToolResult } from "./types";

const DEFINITION: LLMTool = {
  name: "consultar_pedido_atual",
  description:
    "Retorna o carrinho atual do cliente com quantidades, adicionais, subtotal, taxa de entrega e total. Use antes de responder 'quanto deu' ou de fechar o pedido, para não calcular de cabeça.",
  parameters: { type: "object", properties: {} },
};

function brl(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

async function run(ctx: ToolContext): Promise<ToolResult> {
  const { items, deliveryFee } = ctx.session.order;

  if (items.length === 0) {
    return { ok: true, content: "Carrinho vazio. Nenhum item adicionado ainda." };
  }

  const lines = items.map((it) => {
    const extras = it.additionalItems?.length
      ? ` (adicionais: ${it.additionalItems.map((a) => `${a.name} ${brl(a.price)}`).join(", ")})`
      : "";
    return `${it.quantity}x ${it.name}${it.notes ? ` [${it.notes}]` : ""}${extras} = ${brl(it.price * it.quantity)}`;
  });

  const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const fee = ctx.session.orderType === "DELIVERY" ? deliveryFee : 0;

  const summary = [
    ...lines,
    `Subtotal: ${brl(subtotal)}`,
    ...(fee > 0 ? [`Taxa de entrega: ${brl(fee)}`] : []),
    `Total: ${brl(subtotal + fee)}`,
    `Tipo: ${ctx.session.orderType ?? "ainda não definido"}`,
    `Pagamento: ${ctx.session.payment ?? "ainda não definido"}`,
  ].join("\n");

  return { ok: true, content: summary };
}

export const pedidoAtualTool: BotTool = { definition: DEFINITION, execute: run };
