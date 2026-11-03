import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectHumanRequest,
  detectOptOut,
  isExplicitConfirmation,
  normalize,
} from "../src/lib/bot/guardrails/detect";

test("normalize remove acento e caixa (a causa raiz do bug B2)", () => {
  assert.equal(normalize("NÃO"), "nao");
  assert.equal(normalize("  Confirmar! "), "confirmar!");
});

test("detectHumanRequest casa pedidos explícitos de humano", () => {
  assert.equal(detectHumanRequest("quero falar com um atendente"), true);
  assert.equal(detectHumanRequest("me passa pra uma pessoa de verdade"), true);
  assert.equal(detectHumanRequest("preciso de atendimento humano"), true);
  assert.equal(detectHumanRequest("quero falar com o gerente"), true);
});

test("detectHumanRequest não dispara em conversa normal", () => {
  assert.equal(detectHumanRequest("bom dia"), false);
  assert.equal(detectHumanRequest("quero 2 pão de queijo"), false);
  assert.equal(detectHumanRequest("vocês entregam no centro?"), false);
});

test("detectOptOut exige verbo de comunicação, não só 'não quero mais'", () => {
  assert.equal(detectOptOut("para de me mandar mensagem"), true);
  assert.equal(detectOptOut("não quero mais receber"), true);
  assert.equal(detectOptOut("me tira da lista"), true);
  assert.equal(detectOptOut("STOP"), true);
});

test("detectOptOut não silencia o bot de quem só recusou um item", () => {
  assert.equal(detectOptOut("não quero mais pão"), false);
  assert.equal(detectOptOut("não quero"), false);
  assert.equal(detectOptOut("pode parar de colocar açúcar"), false);
});

test("isExplicitConfirmation rejeita recusa com acento (regressão do pedido fechado)", () => {
  // Antes: /\bn(ao)?o\b/ não casava "não" e o pedido era finalizado.
  assert.equal(isExplicitConfirmation("não, pode confirmar"), false);
  assert.equal(isExplicitConfirmation("nao pode confirmar"), false);
  assert.equal(isExplicitConfirmation("não"), false);
  assert.equal(isExplicitConfirmation("nunca"), false);
});

test("isExplicitConfirmation aceita confirmação explícita", () => {
  assert.equal(isExplicitConfirmation("sim"), true);
  assert.equal(isExplicitConfirmation("pode confirmar"), true);
  assert.equal(isExplicitConfirmation("Sim, pode mandar!"), true);
  assert.equal(isExplicitConfirmation("isso mesmo, fechado"), true);
  assert.equal(isExplicitConfirmation("ok"), true);
});

test("isExplicitConfirmation não confirma em pedido de cancelamento", () => {
  assert.equal(isExplicitConfirmation("quero cancelar"), false);
  assert.equal(isExplicitConfirmation("ainda não, quero trocar"), false);
});

test("isExplicitConfirmation prefere uma pergunta extra a fechar pedido recusado", () => {
  // Trade-off documentado: "não tenho troco" bloqueia e o bot pergunta de novo.
  assert.equal(isExplicitConfirmation("não tenho troco, pode confirmar"), false);
});
