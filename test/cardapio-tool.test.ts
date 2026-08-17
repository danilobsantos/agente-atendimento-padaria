import { test } from "node:test";
import assert from "node:assert/strict";
import { LLMAgent, CONSULTAR_CARDAPIO_TOOL } from "../src/lib/bot/llm-agent";
import type { BotSession, BotState } from "../src/lib/types/session";
import type { LLMAgentConfig } from "../src/lib/bot/llm-agent";
import type { SearchProduct } from "../src/lib/services/products.service";
import type { LLMResponse } from "../src/lib/types/llm";
import { isOrderMutable } from "../src/lib/utils/order-status";

const PRODUCT: SearchProduct = {
  id: "prod-uuid-1",
  name: "Pão de Queijo",
  price: 5,
  category: "Padaria",
  categoryId: "cat1",
  description: null,
  shortId: "4",
  extras: [{ id: "ex1", name: "Extra recheio", price: 2 }],
};

function makeSession(): BotSession {
  return {
    tenantId: "t1",
    customerId: "c1",
    phone: "11999999999",
    state: "START" as BotState,
    customer: {},
    order: { items: [], total: 0, deliveryFee: 0 },
    context: [],
  };
}

const CONFIG: LLMAgentConfig = {
  provider: "DEEPSEEK",
  apiKey: "test-key",
  model: "deepseek-v4-flash",
  maxOutputTokens: 1024,
  messageContextLimit: 5,
  temperature: 0.7,
  systemPrompt: "Você é um assistente virtual.",
  menuUrl: "https://app.local",
  cartDescription: "(vazio)",
};

function finalResponse(message: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    intent: "adicionar_itens",
    customerInfo: { name: "", address: "", payment: "" },
    message,
    ...overrides,
  });
}

interface StubLLM {
  generate(messages: unknown[], config?: unknown): Promise<LLMResponse>;
}

function stubService(generator: (call: number, messages: unknown[], config?: unknown) => unknown): StubLLM {
  let call = 0;
  return {
    async generate(messages: unknown[], config?: unknown) {
      call += 1;
      return generator(call, messages, config) as LLMResponse;
    },
  };
}

function runProcess(generator: (call: number, messages: unknown[], config?: unknown) => unknown) {
  return LLMAgent.processMessage(makeSession(), "msg", CONFIG, {
    llmService: stubService(generator),
    searchProducts: async () => [PRODUCT],
  });
}

test("executes consultar_cardapio tool then parses final JSON with correct idMap", async () => {
  const { response, idMap } = await runProcess((call) => {
    if (call === 1) {
      return { text: "", tool_calls: [{ id: "call_1", name: "consultar_cardapio", arguments: '{"busca":"pão"}' }] };
    }
    return { text: finalResponse("Ok! anotei 2x Pão de Queijo.") };
  });

  assert.equal(response.message, "Ok! anotei 2x Pão de Queijo.");
  assert.equal(idMap.get("4"), "prod-uuid-1");
  assert.equal(idMap.has("1"), false);
});

test("parses direct JSON when the model answers without a tool call and idMap stays empty", async () => {
  const { response, idMap } = await runProcess(() => ({ text: finalResponse("Quer mais alguma coisa?") }));
  assert.equal(response.message, "Quer mais alguma coisa?");
  assert.equal(idMap.size, 0);
});

test("retries once when the first parse fails, then succeeds", async () => {
  let calls = 0;
  const { response } = await runProcess(() => {
    calls += 1;
    if (calls === 1) return { text: "not json at all" };
    return { text: finalResponse("Recuperei! Tudo certo.") };
  });
  assert.equal(response.message, "Recuperei! Tudo certo.");
  assert.equal(calls, 2);
});

test("parses markdown-fenced JSON instead of falling back", async () => {
  const { response } = await runProcess(() => ({
    text: "```json\n" + finalResponse("Olá! Quer ver o cardápio?") + "\n```",
  }));
  assert.equal(response.message, "Olá! Quer ver o cardápio?");
});

test("retries WITHOUT tools so adapters force JSON mode", async () => {
  const toolConfigs: unknown[] = [];
  const { response } = await runProcess((_call, _msg, config) => {
    toolConfigs.push((config as { tools?: unknown })?.tools);
    return { text: "not json" };
  });
  assert.equal(response.intent, "generico");
  assert.equal(toolConfigs.length, 2);
  assert.deepEqual(toolConfigs[0], [CONSULTAR_CARDAPIO_TOOL]);
  assert.equal(toolConfigs[1], undefined);
});

test("returns fallback generico when the model never produces valid JSON", async () => {
  let calls = 0;
  const { response } = await runProcess(() => {
    calls += 1;
    return { text: "still not json" };
  });
  assert.equal(response.intent, "generico");
  assert.equal(response.message.includes("falha de comunicação"), true);
  assert.equal(calls, 2);
});

test("bounded tool loop: stops after MAX_TOOL_ROUNDS and falls back", async () => {
  const { response } = await runProcess(() => ({
    text: "",
    tool_calls: [{ id: "call_x", name: "consultar_cardapio", arguments: "{}" }],
  }));
  assert.equal(response.intent, "generico");
});

test("preserves _raw (Gemini thoughtSignature) through the tool round-trip", async () => {
  let assistantMsg: { tool_calls?: { _raw?: { thoughtSignature?: string } }[] } | undefined;
  const { idMap } = await runProcess((call, messages) => {
    if (call === 1) {
      return {
        text: "",
        tool_calls: [{
          id: "call_1",
          name: "consultar_cardapio",
          arguments: '{"busca":"pão"}',
          _raw: { functionCall: { name: "consultar_cardapio" }, thoughtSignature: "sig-123" },
        }],
      };
    }
    assistantMsg = (messages as { role?: string; tool_calls?: unknown }[]).find(
      (m) => m.role === "assistant" && m.tool_calls
    ) as { tool_calls?: { _raw?: { thoughtSignature?: string } }[] } | undefined;
    return { text: finalResponse("Ok!") };
  });
  assert.equal(idMap.get("4"), "prod-uuid-1");
  assert.equal(assistantMsg?.tool_calls?.[0]?._raw?.thoughtSignature, "sig-123");
});

test("isOrderMutable: only PENDING/CONFIRMED/PREPARING orders keep the active session", () => {
  assert.equal(isOrderMutable("PENDING"), true);
  assert.equal(isOrderMutable("CONFIRMED"), true);
  assert.equal(isOrderMutable("DISPATCHED"), false);
  assert.equal(isOrderMutable("READY"), false);
  assert.equal(isOrderMutable("DELIVERED"), false);
  assert.equal(isOrderMutable("CANCELLED"), false);
});