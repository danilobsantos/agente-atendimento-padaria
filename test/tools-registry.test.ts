import { test } from "node:test";
import assert from "node:assert/strict";
import { BOT_TOOLS, TOOL_DEFINITIONS, executeTool, type ToolContext } from "../src/lib/bot/tools";
import type { BotSession } from "../src/lib/types/session";

function ctx(overrides: Partial<BotSession> = {}): ToolContext {
  const session: BotSession = {
    tenantId: "t1",
    customerId: "c1",
    phone: "11999999999",
    state: "START" as BotSession["state"],
    customer: {},
    order: { items: [], total: 0, deliveryFee: 0 },
    context: [],
    ...overrides,
  };
  return { tenantId: "t1", customerId: "c1", session };
}

test("toda tool anunciada tem implementação (sem tool fantasma)", () => {
  assert.deepEqual(
    TOOL_DEFINITIONS.map((t) => t.name).sort(),
    BOT_TOOLS.map((t) => t.definition.name).sort(),
  );
});

test("tool desconhecida devolve erro instrucional, não lança", async () => {
  const result = await executeTool(ctx(), "apagar_banco", "{}");
  assert.equal(result.ok, false);
  assert.equal(result.content.includes("apagar_banco"), true);
  assert.equal(result.content.includes("consultar_cardapio"), true);
});

test("argumentos malformados não derrubam o turno", async () => {
  const result = await executeTool(ctx(), "consultar_cardapio", "{busca:");
  assert.equal(result.ok, false);
  assert.equal(result.content.includes("argumentos_invalidos"), true);
});

test("consultar_pedido_atual lê o carrinho da sessão", async () => {
  const result = await executeTool(
    ctx({
      orderType: "DELIVERY",
      payment: "PIX",
      order: {
        items: [{ productId: "p1", name: "Pão de queijo", quantity: 2, price: 5 }],
        total: 10,
        deliveryFee: 8,
      },
    }),
    "consultar_pedido_atual",
    "{}",
  );

  assert.equal(result.ok, true);
  assert.equal(result.content.includes("2x Pão de queijo"), true);
  assert.equal(result.content.includes("Subtotal: R$ 10.00"), true);
  assert.equal(result.content.includes("Taxa de entrega: R$ 8.00"), true);
  assert.equal(result.content.includes("Total: R$ 18.00"), true);
});

test("consultar_pedido_atual avisa carrinho vazio", async () => {
  const result = await executeTool(ctx(), "consultar_pedido_atual", "{}");
  assert.equal(result.ok, true);
  assert.equal(result.content.toLowerCase().includes("vazio"), true);
});
