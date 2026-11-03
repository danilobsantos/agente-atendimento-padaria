import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPrices,
  extractBrlCents,
  hasDeliveryPromise,
  stripDeliveryPromises,
} from "../src/lib/bot/guardrails/price-guard";

test("extractBrlCents lê os formatos que o bot realmente escreve", () => {
  assert.deepEqual(extractBrlCents("R$ 3,50"), [350]);
  assert.deepEqual(extractBrlCents("R$3,50"), [350]);
  assert.deepEqual(extractBrlCents("R$ 1.234,56"), [123456]);
  assert.deepEqual(extractBrlCents("R$ 10"), [1000]);
  assert.deepEqual(extractBrlCents("R$ 5,00 e R$ 12,90"), [500, 1290]);
});

test("extractBrlCents ignora valor sem R$ ('10 reais de pão' é pedido, não preço)", () => {
  assert.deepEqual(extractBrlCents("quero 10 reais de pão"), []);
});

test("checkPrices aceita valores que existem no catálogo", () => {
  const allowed = [500, 1290, 4500];
  assert.deepEqual(checkPrices("O pão de queijo custa R$ 5,00.", allowed), { ok: true, offending: [] });
  assert.deepEqual(checkPrices("Total: R$ 45,00", allowed), { ok: true, offending: [] });
});

test("checkPrices veta preço inventado e devolve o valor ofensor", () => {
  const result = checkPrices("Fica R$ 99,90 no total.", [4500]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.offending, [9990]);
});

test("checkPrices sem valor citado não veta nada", () => {
  assert.deepEqual(checkPrices("Anotei! Quer mais alguma coisa?", [4500]), { ok: true, offending: [] });
});

test("hasDeliveryPromise detecta promessa de prazo", () => {
  assert.equal(hasDeliveryPromise("Seu pedido sai em 20 minutos."), true);
  assert.equal(hasDeliveryPromise("Chego em 15 min."), true);
  assert.equal(hasDeliveryPromise("Anotei o endereço, falta o pagamento."), false);
});

test("stripDeliveryPromises remove a frase do prazo e preserva o resto", () => {
  const { text, removed } = stripDeliveryPromises("Seu pedido sai em 20 minutos. Quer mais alguma coisa?");
  assert.equal(removed, true);
  assert.equal(text.includes("20 minutos"), false);
  assert.equal(text.includes("Quer mais alguma coisa?"), true);
});

test("stripDeliveryPromises não mexe em mensagem sem prazo", () => {
  const original = "Anotei 2 pães. Falta o endereço.";
  assert.deepEqual(stripDeliveryPromises(original), { text: original, removed: false });
});
