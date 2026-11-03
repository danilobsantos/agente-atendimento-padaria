import { test } from "node:test";
import assert from "node:assert/strict";
import { ToolBreaker } from "../src/lib/bot/tool-breaker";

test("libera a tool enquanto as falhas são poucas", () => {
  const breaker = new ToolBreaker(2);
  breaker.record("consultar_cardapio", '{"busca":"x"}', false);
  assert.equal(breaker.isBlocked("consultar_cardapio", '{"busca":"x"}'), false);
});

test("bloqueia a mesma tool+args após atingir o limite", () => {
  const breaker = new ToolBreaker(2);
  breaker.record("consultar_cardapio", '{"busca":"x"}', false);
  breaker.record("consultar_cardapio", '{"busca":"x"}', false);
  assert.equal(breaker.isBlocked("consultar_cardapio", '{"busca":"x"}'), true);
});

test("não bloqueia a mesma tool com outros argumentos", () => {
  const breaker = new ToolBreaker(1);
  breaker.record("consultar_cardapio", '{"busca":"x"}', false);
  assert.equal(breaker.isBlocked("consultar_cardapio", '{"busca":"y"}'), false);
});

test("sucesso não conta como falha", () => {
  const breaker = new ToolBreaker(1);
  breaker.record("consultar_cardapio", "{}", true);
  assert.equal(breaker.isBlocked("consultar_cardapio", "{}"), false);
});
