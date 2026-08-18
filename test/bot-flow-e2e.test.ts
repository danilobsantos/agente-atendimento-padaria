import "dotenv/config";
import { after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { redisKey, redisPub, redisSub } from "../src/lib/redis";
import { POST } from "../src/app/api/chat/process-bot/route";
import { createLLMService } from "../src/lib/adapters/factory";
import { ProductsService } from "../src/lib/services/products.service";
import type { LLMServiceConfig, LLMMessage, LLMResponse } from "../src/lib/types/llm";
import type { LLMProvider } from "../src/generated/prisma/client";

// E2E com LLM REAL (bot e cliente). Queima tokens — força o env RUN_E2E=1.
// npm run test:e2e  (não roda no npm test normal)
const ENABLED = process.env.RUN_E2E === "1";

const CUSTOMER_ID = "55555555-5555-5555-5555-555555555555";
const PHONE = "5511988889999";

const CUSTOMER_REPLY_TOOL = {
  name: "mensagem_cliente",
  description:
    "Envie sua resposta ao atendente como a MENSAGEM de texto que você digitaria no WhatsApp. NÃO descreva a intenção: escreva a mensagem exata, em texto curto e natural, como uma pessoa.",
  parameters: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
  },
};

interface Goal {
  items: Array<{ name: string; quantity: number }>;
  orderType: "DELIVERY" | "PICKUP";
  name: string;
  address?: string;
  payment: string;
  confirmations: number; // quantas vezes o bot deve confirmar "gerado com sucesso"
}

const noopSend = async () => {};

let botApiKeyFallback = "";
let TENANT_ID = "";

function customerConfig(): LLMServiceConfig & { _rawProvider: LLMProvider } {
  const provider = (process.env.E2E_CUSTOMER_LLM_PROVIDER || "GEMINI") as LLMProvider;
  return {
    apiKey: process.env.E2E_CUSTOMER_LLM_APIKEY || botApiKeyFallback,
    model: process.env.E2E_CUSTOMER_LLM_MODEL || "gemini-3.5-flash",
    maxOutputTokens: 500,
    temperature: 0.8,
    tools: [CUSTOMER_REPLY_TOOL],
    _rawProvider: provider,
  };
}

function extractCustomerMessage(res: LLMResponse): string {
  if (res.tool_calls && res.tool_calls.length > 0) {
    try {
      const args = JSON.parse(res.tool_calls[0].arguments);
      if (args.message) return String(args.message).trim();
    } catch {
      // ignore malformed args
    }
  }
  return (res.text || "").trim();
}

function customerSystemPrompt(goal: Goal): string {
  const items = goal.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
  const address = goal.address ? `\n- Endereço para entrega: ${goal.address}` : "";
  return `Você é um cliente real mandando mensagem pelo WhatsApp para a padaria Sabor de Minas, com objetivo de fazer um pedido.
Meta: ${goal.orderType === "PICKUP" ? "RETIRADA no balcão (não precisa de endereço)" : "ENTREGA"} dos itens: ${items}.
Seu nome: ${goal.name}. Pagamento: ${goal.payment}.${address}

REGRAS:
- Mande UMA mensagem curta e natural por turno, como uma pessoa real (ex: "boa tarde", "quero fazer um pedido", "entrega", "1 tapioca e 1 suco", "meu nome é X, rua tal", "cartão", "sim").
- Siga o fluxo sugerido pelo atendente. Não invente produtos fora da meta.
- Quando o atendente confirmar o pedido com "gerado com sucesso", e ainda faltarem etapas da meta, continue para completá-las (ex: adicionar item) e confirme de novo.
- Quando TODAS as ${goal.confirmations} confirmações de "gerado com sucesso" tiverem ocorrido, responda APENAS: DONE`;
}

const DONE_RE = /gerado com sucesso/i;

async function writeTranscript(stage: string, transcript: string, order?: { status: string; items: unknown[] }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const items = (order?.items ?? [])
    .map((i) => `${(i as { quantity: number }).quantity}x ${(i as { name: string }).name}`)
    .join(", ");
  const md = `# E2E — ${stage}\nData: ${new Date().toISOString()}\nStatus final: ${order?.status ?? "n/a"}\nItens: ${items ?? "n/a"}\n${transcript}\n`;
  const dir = `${process.cwd()}/test/e2e/transcripts`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${stamp}_${stage.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`, md);
}

async function resolveOrderItems(goal: Goal) {
  return Promise.all(
    goal.items.map(async (it) => {
      const found = await ProductsService.searchProducts(TENANT_ID, { busca: it.name }, 5);
      const hit = found.find((p) =>
        it.name.toLowerCase().split(" ").every((w) => p.name.toLowerCase().includes(w)),
      ) ?? found[0];
      assert.ok(hit, `produto da meta não encontrado no cardápio: ${it.name}`);
      return { productId: hit.id, quantity: it.quantity, name: hit.name };
    }),
  );
}

async function runGoal(goal: Goal): Promise<void> {
  const cfg = customerConfig();
  const customerLLM = createLLMService(cfg._rawProvider);
  const history: LLMMessage[] = [];
  let confirmed = 0;
  let transcript = "";

  for (let turn = 0; turn < 12; turn++) {
    const reply = await customerLLM.generate(
      [
        { role: "system", content: customerSystemPrompt(goal) },
        ...history,
        { role: "user", content: "É a sua vez de responder." },
      ],
      cfg,
    );
    const text = extractCustomerMessage(reply);
    if (!text) continue;
    if (text.toUpperCase() === "DONE") break;

    history.push({ role: "user", content: text });
    transcript += `\n[cliente] ${text}`;

    const res = await POST(
      new Request("http://test/api/chat/process-bot", {
        method: "POST",
        body: JSON.stringify({ customerId: CUSTOMER_ID, message: text }),
      }),
      { send: noopSend, debounceMs: 0 },
    );
    const body = await res.json();
    const botText = typeof body?.response === "string" ? body.response : "";
    history.push({ role: "assistant", content: botText || "(sem resposta)" });
    transcript += `\n[atendente] ${botText || `HTTP ${res.status}`}`;

    if (DONE_RE.test(botText)) {
      confirmed += 1;
      if (confirmed >= goal.confirmations) break;
    }
  }

  console.log(`\n=== TRANSCRIPT (${goal.orderType}) ===${transcript}\n`);

  const expected = await resolveOrderItems(goal);
  const order = await prisma.order.findFirstOrThrow({
    where: { customerId: CUSTOMER_ID },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  await writeTranscript(`${goal.name} ${goal.orderType}`, transcript, order);
  assert.equal(order.status, "CONFIRMED");
  for (const exp of expected) {
    const item = order.items.find((i) => i.productId === exp.productId);
    assert.ok(item, `item faltando no pedido final: ${exp.name}`);
    assert.equal(item.quantity, exp.quantity, `qty errada para ${exp.name}`);
  }
}

async function cleanTestCustomer(): Promise<void> {
  await prisma.orderItem.deleteMany({ where: { order: { customerId: CUSTOMER_ID } } });
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
  await prisma.customer.deleteMany({ where: { id: CUSTOMER_ID } });
}

beforeEach(async () => {
  await cleanTestCustomer();
  // Usa o tenant REAL existente: nenhum tenant/produto novo é criado.
  // Apenas um customer de teste é criado e removido ao final.
  const real = await prisma.tenant.findFirst({
    where: { active: true },
    include: { botSetting: true },
  });
  assert.ok(real?.botSetting?.llmApiKey, "E2E exige BotSetting do tenant ativo com llmApiKey configurado (admin /configuracoes)");
  TENANT_ID = real.id;
  botApiKeyFallback = real.botSetting.llmApiKey;
  await prisma.customer.create({
    data: { id: CUSTOMER_ID, tenantId: TENANT_ID, phone: PHONE, name: "Teste E2E" },
  });
});

afterEach(async () => {
  await cleanTestCustomer();
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

test(
  "E1 delivery + adicionar omelete após confirmar (regressão #4AD8, LLM real)",
  { skip: !ENABLED },
  async () => {
    await runGoal({
      items: [
        { name: "Tapioca com peito de peru e queijo fresco", quantity: 1 },
        { name: "Detox Vita C", quantity: 1 },
      ],
      orderType: "DELIVERY",
      name: "Danilo Santos",
      address: "Av. Teste 123",
      payment: "Cartão",
      confirmations: 1,
    });

    // Segunda fase: adicionar omelete ao pedido já confirmado
    const addGoal: Goal = {
      items: [
        { name: "Tapioca com peito de peru e queijo fresco", quantity: 1 },
        { name: "Detox Vita C", quantity: 1 },
        { name: "Omelete completo", quantity: 1 },
      ],
      orderType: "DELIVERY",
      name: "Danilo Santos",
      address: "Av. Teste 123",
      payment: "Cartão",
      confirmations: 1,
    };
    const cfg = customerConfig();
    const customerLLM = createLLMService(cfg._rawProvider);
    const prompt = `${customerSystemPrompt(addGoal)}\n\nIMPORTANTE: você JÁ tem um pedido ativo (tapioca+detox confirmados). Agora você quer ADICIONAR "1 omelete completo". Avise que quer adicionar um item, adicione e confirme. Responda DONE quando o atendente gerar com sucesso de novo.`;
    const history: LLMMessage[] = [];
    let transcript = "";
    for (let turn = 0; turn < 10; turn++) {
      const reply = await customerLLM.generate(
        [{ role: "system", content: prompt }, ...history, { role: "user", content: "É a sua vez." }],
        cfg,
      );
      const text = extractCustomerMessage(reply);
      if (!text) continue;
      if (text.toUpperCase() === "DONE") break;
      history.push({ role: "user", content: text });
      transcript += `\n[cliente] ${text}`;
      const res = await POST(
        new Request("http://test/api/chat/process-bot", {
          method: "POST",
          body: JSON.stringify({ customerId: CUSTOMER_ID, message: text }),
        }),
        { send: noopSend, debounceMs: 0 },
      );
      const body = await res.json();
      const botText = typeof body?.response === "string" ? body.response : "";
      history.push({ role: "assistant", content: botText || "(sem resposta)" });
      transcript += `\n[atendente] ${botText || `HTTP ${res.status}`}`;
      if (DONE_RE.test(botText)) break;
    }
    console.log(`\n=== TRANSCRIPT (fase adicionar) ===${transcript}\n`);

    const order = await prisma.order.findFirstOrThrow({
      where: { customerId: CUSTOMER_ID },
      include: { items: true },
    });
    await writeTranscript(`${addGoal.name} FASE-ADICIONAR`, transcript, order);
    assert.equal(order.items.length, 3, "pedido deveria ter 3 itens");
    const [omeleteProd] = await ProductsService.searchProducts(TENANT_ID, { busca: "Omelete completo" }, 5);
    assert.ok(omeleteProd, "omelete não encontrado no cardápio existente");
    const omelete = order.items.find((i) => i.productId === omeleteProd.id);
    assert.ok(omelete, "omelete deveria estar no pedido");
    assert.equal(omelete.quantity, 1, "omelete NÃO deve duplicar (regressão #4AD8)");
  },
);

test(
  "E2 pickup sem endereço (LLM real)",
  { skip: !ENABLED },
  async () => {
    await runGoal({
      items: [{ name: "Pão de queijo - Requeijão (GRANDE)", quantity: 2 }],
      orderType: "PICKUP",
      name: "Maria Silva",
      payment: "Pix",
      confirmations: 1,
    });
    const order = await prisma.order.findFirstOrThrow({ where: { customerId: CUSTOMER_ID } });
    assert.equal(order.deliveryAddress, null, "pickup não deve ter deliveryAddress");
  },
);