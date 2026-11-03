import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCostCents } from "../src/lib/llm/runner";
import { flattenToolHistory } from "../src/lib/bot/llm-agent";
import type { LLMMessage } from "../src/lib/types/llm";

test("estimateCostCents usa a tabela por família em centavos de dólar", () => {
  assert.equal(estimateCostCents("deepseek-chat", { inputTokens: 1_000_000, outputTokens: 0 }), 27);
  assert.equal(estimateCostCents("deepseek-reasoner", { inputTokens: 0, outputTokens: 1_000_000 }), 110);
  assert.equal(estimateCostCents("gemini-2.5-flash", { inputTokens: 1_000_000, outputTokens: 0 }), 30);
});

test("estimateCostCents preserva fração de centavo (um turno custa ~0,15 centavo)", () => {
  const cents = estimateCostCents("deepseek-chat", { inputTokens: 4000, outputTokens: 300 });
  assert.equal(cents !== null && cents > 0 && cents < 1, true);
});

test("estimateCostCents devolve null para modelo fora da tabela", () => {
  assert.equal(estimateCostCents("llama-3", { inputTokens: 1000, outputTokens: 100 }), null);
  assert.equal(estimateCostCents("deepseek-chat", undefined), null);
});

test("flattenToolHistory achata o par assistant+tool em texto e descarta tool órfã", () => {
  const messages: LLMMessage[] = [
    { role: "system", content: "sys" },
    { role: "user", content: "quero pão" },
    {
      role: "assistant",
      content: "",
      tool_calls: [{ id: "c1", name: "consultar_cardapio", arguments: '{"busca":"pao"}' }],
    },
    { role: "tool", tool_call_id: "c1", name: "consultar_cardapio", content: "1.Pão R$5.00" },
    { role: "tool", tool_call_id: "orfao", name: "x", content: "lixo" },
  ];

  const flat = flattenToolHistory(messages);

  assert.equal(flat.length, 3);
  assert.equal(flat[0].role, "system");
  assert.equal(flat[1].role, "user");
  assert.equal(flat[2].role, "assistant");
  assert.equal(flat[2].content.includes("consultar_cardapio"), true);
  assert.equal(flat[2].content.includes("1.Pão R$5.00"), true);
  assert.equal(flat.some((m) => m.role === "tool"), false);
});
