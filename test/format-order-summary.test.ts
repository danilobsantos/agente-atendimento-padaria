import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOrderSummary } from "../src/lib/utils/format-order-summary";

const ORDER = {
  id: "uuid-xyz-e6-25",
  total: 16,
  notes: "Pagamento: PIX",
  items: [
    {
      quantity: 2,
      price: 6,
      notes: "bem quentinho",
      product: { name: "Pão de Queijo" },
      additionalItems: [{ name: "Requeijão", price: 2 }],
    },
    { quantity: 1, price: 4, notes: null, product: { name: "Coxinha" } },
  ],
};

test("formatOrderSummary builds delivery summary with extras and obs", () => {
  const text = formatOrderSummary({
    ...ORDER,
    deliveryAddress: { street: "Rua das Flores", number: "123", neighborhood: "Centro" },
  });

  assert.match(text, /#E625/);
  assert.match(text, /2x Pão de Queijo/);
  assert.match(text, /\+ Requeijão \(\+R\$ 2,00\)/);
  assert.match(text, /Obs: bem quentinho/);
  assert.match(text, /1x Coxinha/);
  assert.match(text, /Total: R\$ 16,00/);
  assert.match(text, /Forma de pagamento: Pagamento: PIX/);
  assert.match(text, /Entrega: Rua das Flores, 123 - Centro/);
});

test("formatOrderSummary handles pickup (no deliveryAddress) with fullAddress", () => {
  const text = formatOrderSummary({
    ...ORDER,
    deliveryAddress: { fullAddress: "Av. Central, 500 - Centro" },
  });

  assert.match(text, /Entrega: Av. Central, 500 - Centro/);
});

test("formatOrderSummary defaults to retirada when no address", () => {
  const text = formatOrderSummary({ ...ORDER, deliveryAddress: null });

  assert.match(text, /Retirada no balcão/);
  assert.doesNotMatch(text, /Entrega:/);
});