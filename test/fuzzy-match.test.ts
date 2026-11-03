import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesProduct, normalize, tokenHitRatio } from "../src/lib/utils/fuzzy";

test("normalize e matchesProduct continuam funcionando após a extração", () => {
  assert.equal(normalize("Pão de Queijo"), "pao de queijo");
  assert.equal(matchesProduct("pao de queijo", "padaria", "pao"), true);
  assert.equal(matchesProduct("bolo de fuba", "bolos", "bolo de fuba caseiro"), true);
  assert.equal(matchesProduct("suco de laranja", "bebidas", "bolo"), false);
});

test("tokenHitRatio casa pergunta de FAQ com erro de digitação", () => {
  const target = "Qual o horário de funcionamento? horario abre fecha";
  assert.equal(tokenHitRatio("que horas vocês abrem?", target) >= 0.5, true);
  assert.equal(tokenHitRatio("horario de funcionamento", target) >= 0.9, true);
});

test("tokenHitRatio rejeita pergunta de outro assunto", () => {
  const target = "Qual o horário de funcionamento? horario abre fecha";
  assert.equal(tokenHitRatio("vocês entregam no bairro industrial?", target) >= 0.5, false);
});

test("tokenHitRatio ignora palavras vazias", () => {
  assert.equal(tokenHitRatio("de", "qualquer coisa"), 0);
});
