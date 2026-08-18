import "dotenv/config";
import { after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { redisKey, redisPub, redisSub } from "../src/lib/redis";
import { POST, type BotRouteDeps } from "../src/app/api/chat/process-bot/route";
import type { AgentResponse } from "../src/lib/bot/llm-agent";
import type { LLMResponse } from "../src/lib/types/llm";

const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const PHONE = "5511988887777";

const P_TAPIOCA = "00000000-0000-0000-0000-000000000001";
const P_DETOX = "00000000-0000-0000-0000-000000000002";
const P_OMELETE = "00000000-0000-0000-0000-000000000003";

const noopSend: BotRouteDeps["send"] = async () => {};

function req(message: string): Request {
  return new Request("http://test/api/chat/process-bot", {
    method: "POST",
    body: JSON.stringify({ customerId: CUSTOMER_ID, message }),
  });
}

function fakeLLM(queue: AgentResponse[]): NonNullable<BotRouteDeps["llmService"]> {
  return {
    async generate(): Promise<LLMResponse> {
      const next = queue.shift();
      if (!next) throw new Error("fakeLLM: no more canned responses");
      return { text: JSON.stringify(next) };
    },
  };
}

async function runTurn(message: string, canned: AgentResponse): Promise<Response> {
  return POST(req(message), {
    llmService: fakeLLM([canned]),
    send: noopSend,
    debounceMs: 0,
  });
}

function canned(
  intent: AgentResponse["intent"],
  overrides: Partial<AgentResponse> = {},
): AgentResponse {
  return {
    intent,
    customerInfo: { name: "", address: "", payment: "" },
    message: "ok",
    ...overrides,
  };
}

function qty(id: string, quantity = 1) {
  return { id, quantity };
}

async function cleanTenantData(): Promise<void> {
  // OrderItem.product tem onDelete: Restrict — apagar orderItem ANTES do tenant
  await prisma.orderItem.deleteMany({
    where: { order: { customer: { tenantId: TENANT_ID } } },
  });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

beforeEach(async () => {
  // limpa resíduos de runs anteriores mortos no meio
  await cleanTenantData();
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: "Teste", slug: `test-${TENANT_ID}` },
  });
  await prisma.botSetting.create({
    data: {
      tenantId: TENANT_ID,
      llmApiKey: "test-key",
      llmProvider: "DEEPSEEK",
      llmModel: "deepseek-v4-flash",
      isActive: true,
      systemPrompt: "Você é um assistente virtual.",
    },
  });
  await prisma.product.createMany({
    data: [
      { id: P_TAPIOCA, tenantId: TENANT_ID, name: "Tapioca com presunto e muçarela", price: 18.9 },
      { id: P_DETOX, tenantId: TENANT_ID, name: "Detox laranja", price: 16 },
      { id: P_OMELETE, tenantId: TENANT_ID, name: "Omelete completo", price: 18 },
    ],
  });
  await prisma.customer.create({
    data: { id: CUSTOMER_ID, tenantId: TENANT_ID, phone: PHONE },
  });
});

afterEach(async () => {
  await cleanTenantData();
  await redisPub.del(
    redisKey("session", TENANT_ID, CUSTOMER_ID),
    redisKey("buffer", "msgs", TENANT_ID, CUSTOMER_ID),
    redisKey("buffer", "lock", TENANT_ID, CUSTOMER_ID),
  );
});

after(async () => {
  await prisma.$disconnect();
  redisPub.disconnect();
  redisSub.disconnect();
});

// Conversa de entrega + novo item após confirmação (regressão #4AD8: omelete NÃO pode dobrar).
test("entrega com 2 itens + adicionar item após confirmar duplica quantidade", async () => {
  // turnos 1-7: monta o pedido de entrega e confirma
  await runTurn("boa noite, gostaria de fazer um pedido", canned("generico"));
  await runTurn("posso fazer por aqui mesmo?", canned("generico"));
  await runTurn("entrega", canned("generico", { orderType: "DELIVERY" }));
  await runTurn(
    "1 tapioca com presunto e muçarela e 1 suco detox de laranja",
    canned("adicionar_itens", { products: [qty(P_TAPIOCA), qty(P_DETOX)] }),
  );
  await runTurn(
    "Danilo Santos / Av. Teste 123",
    canned("generico", { customerInfo: { name: "Danilo Santos", address: "Av. Teste 123", payment: "" } }),
  );
  await runTurn(
    "Cartão",
    canned("generico", { customerInfo: { name: "", address: "", payment: "Cartão" } }),
  );
  await runTurn("sim", canned("confirmar_pedido"));

  const order = await prisma.order.findFirstOrThrow({
    where: { customerId: CUSTOMER_ID },
    include: { items: true },
  });
  assert.equal(order.status, "CONFIRMED");
  assert.equal(order.total, 34.9);
  const addr = order.deliveryAddress as { fullAddress: string } | null;
  assert.equal(addr?.fullAddress, "Av. Teste 123");
  assert.equal(order.notes, "Cartão");
  assert.deepEqual(
    order.items.map((i) => [i.productId, i.quantity]).sort(),
    [
      [P_TAPIOCA, 1],
      [P_DETOX, 1],
    ].sort(),
  );

  // turnos 8-10: adiciona omelete ao pedido ativo e confirma de novo
  await runTurn("posso adicionar um item?", canned("generico"));
  await runTurn(
    "1 omelete completo",
    canned("adicionar_itens", {
      products: [qty(P_TAPIOCA), qty(P_DETOX), qty(P_OMELETE)],
    }),
  );
  await runTurn("sim", canned("confirmar_pedido"));

  const updated = await prisma.order.findFirstOrThrow({
    where: { customerId: CUSTOMER_ID },
    include: { items: true },
  });
  assert.equal(updated.total, 52.9);
  const omelete = updated.items.find((i) => i.productId === P_OMELETE);
  assert.ok(omelete, "omelete deveria existir no pedido");
  assert.equal(omelete.quantity, 1, "omelete NÃO pode duplicar (regressão #4AD8)");
  assert.deepEqual(
    updated.items.map((i) => [i.productId, i.quantity]).sort(),
    [
      [P_TAPIOCA, 1],
      [P_DETOX, 1],
      [P_OMELETE, 1],
    ].sort(),
  );
});

// Sessão órfã: activeOrderId aponta para pedido inexistente (P2025). Deve liberar e zerar o carrinho.
test("sessão com activeOrderId órfão segue sem erro e cria pedido limpo", async () => {
  const session = {
    tenantId: TENANT_ID,
    customerId: CUSTOMER_ID,
    phone: PHONE,
    state: "START",
    customer: { name: "Datilo", address: "Rua Orfã 1" },
    order: {
      items: [{ productId: P_TAPIOCA, name: "Tapioca", price: 18.9, quantity: 1 }],
      total: 18.9,
      deliveryFee: 0,
    },
    payment: "Cartão",
    activeOrderId: "99999999-9999-9999-9999-999999999999",
    context: [],
  };
  await redisPub.set(redisKey("session", TENANT_ID, CUSTOMER_ID), JSON.stringify(session));

  await runTurn("quero 1 tapioca", canned("adicionar_itens", { products: [qty(P_TAPIOCA)] }));
  await runTurn("sim", canned("confirmar_pedido"));

  const order = await prisma.order.findFirstOrThrow({
    where: { customerId: CUSTOMER_ID },
    include: { items: true },
  });
  assert.equal(order.status, "CONFIRMED");
  assert.deepEqual(order.items.map((i) => [i.productId, i.quantity]), [[P_TAPIOCA, 1]]);
});

// Cancelamento via intent LLM: status vira CANCELLED e customer fica sem pedido ativo.
test("cancelamento via LLM cancela o pedido no banco", async () => {
  await runTurn("boa noite", canned("generico"));
  await runTurn("entrega", canned("generico", { orderType: "DELIVERY" }));
  await runTurn("1 tapioca", canned("adicionar_itens", { products: [qty(P_TAPIOCA)] }));
  await runTurn(
    "Danilo Santos / Av. Teste 123",
    canned("generico", { customerInfo: { name: "Danilo Santos", address: "Av. Teste 123", payment: "" } }),
  );
  await runTurn("Cartão", canned("generico", { customerInfo: { name: "", address: "", payment: "Cartão" } }));
  await runTurn("sim", canned("confirmar_pedido"));

  const order = await prisma.order.findFirstOrThrow({ where: { customerId: CUSTOMER_ID } });
  const orderId = order.id;

  await runTurn("quero cancelar meu pedido", canned("cancelar_pedido"));

  const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  assert.equal(cancelled.status, "CANCELLED");
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: CUSTOMER_ID } });
  assert.equal(customer.activeOrderId, null);
});

// Encomenda no início: handover humano + NENHUM pedido criado.
test("encomenda ativa atendimento humano e não cria pedido", async () => {
  await runTurn(
    "gostaria de uma encomenda especial para um aniversário",
    canned("generico", { orderType: "ENCOMENDA" }),
  );

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: CUSTOMER_ID } });
  assert.equal(customer.isHumanAttending, true);
  const orders = await prisma.order.count({ where: { customerId: CUSTOMER_ID } });
  assert.equal(orders, 0);
});

// Pickup: sem endereço, mas com pagamento.
test("retirada no balcão não exige endereço", async () => {
  await runTurn("boa noite", canned("generico"));
  await runTurn("retirada", canned("generico", { orderType: "PICKUP" }));
  await runTurn(
    "1 tapioca e 1 detox",
    canned("adicionar_itens", { products: [qty(P_TAPIOCA), qty(P_DETOX)] }),
  );
  await runTurn(
    "Danilo Santos",
    canned("generico", { customerInfo: { name: "Danilo Santos", address: "", payment: "" } }),
  );
  await runTurn("Pix", canned("generico", { customerInfo: { name: "", address: "", payment: "Pix" } }));
  await runTurn("sim", canned("confirmar_pedido"));

  const order = await prisma.order.findFirstOrThrow({
    where: { customerId: CUSTOMER_ID },
    include: { items: true },
  });
  assert.equal(order.status, "CONFIRMED");
  assert.equal(order.deliveryAddress, null);
  assert.equal(order.total, 34.9);
  assert.equal(order.items.length, 2);
});

// LLM drift: devolve "confirmar_pedido" enquanto PEDE confirmação. O pedido NÃO
// pode ser finalizado antes do cliente confirmar explicitamente.
test("intent confirmar_pedido sem confirmação explícita não finaliza o pedido", async () => {
  await runTurn("retirada", canned("generico", { orderType: "PICKUP" }));
  await runTurn(
    "1 tapioca e 1 detox",
    canned("adicionar_itens", { products: [qty(P_TAPIOCA), qty(P_DETOX)] }),
  );

  // Drift: mensagem é um NOME, mas o LLM marca confirmar_pedido e pede confirmação.
  const res = await runTurn(
    "Danilo Santos",
    canned("confirmar_pedido", {
      message: "Podemos confirmar o pedido?",
      customerInfo: { name: "Danilo Santos", address: "", payment: "Pix" },
    }),
  );
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, "success");
  assert.match(body.response, /Podemos confirmar o pedido\?/);
  assert.doesNotMatch(body.response, /\(Pedido/i);
  assert.equal(await prisma.order.count({ where: { customerId: CUSTOMER_ID } }), 0);

  // Confirmação explícita depois → finaliza normalmente.
  await runTurn("sim", canned("confirmar_pedido"));
  const order = await prisma.order.findFirstOrThrow({ where: { customerId: CUSTOMER_ID } });
  assert.equal(order.status, "CONFIRMED");
});

// Produto inexistente: não lança erro e não cria pedido.
test("produto inexistente é ignorado sem criar pedido", async () => {
  const res = await runTurn(
    "quero 1 item que não existe",
    canned("adicionar_itens", { products: [qty("00000000-0000-0000-0000-00000000dead")] }),
  );
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, "success");
  const orders = await prisma.order.count({ where: { customerId: CUSTOMER_ID } });
  assert.equal(orders, 0);
});

// A rota usa o debounceSeconds salvo no botSetting (não 2s fixo) quando
// deps.debounceMs não é injetado.
test("debounce usa botSetting.debounceSeconds quando deps.debounceMs é omitido", async () => {
  await prisma.botSetting.update({
    where: { tenantId: TENANT_ID },
    data: { debounceSeconds: 1 },
  });

  const start = Date.now();
  const res = await POST(req("boa noite"), {
    llmService: fakeLLM([canned("generico")]),
    send: noopSend,
  });
  const elapsed = Date.now() - start;

  assert.equal(res.status, 200);
  assert.ok(elapsed >= 800, `esperava aguardar ~1s (debounce=1), levou ${elapsed}ms`);
  assert.ok(elapsed < 1900, `nenhum lock/debounce longo: levou ${elapsed}ms`);
});