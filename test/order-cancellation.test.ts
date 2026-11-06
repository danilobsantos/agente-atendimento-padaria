import { test } from "node:test";
import assert from "node:assert/strict";
import { formatOrderNumber } from "../src/lib/utils/format-order";
import type { SendChunkedParams } from "../src/lib/bot/message-sender";

test("cancellation message template formats greeting and order number correctly", () => {
  const orderId = "72b04f0b-0a4b-4c30-98e5-71d69a43e625";
  const formattedId = formatOrderNumber(orderId);
  assert.equal(formattedId, "#E625");

  const customerName = "Danilo Santos";
  const firstName = customerName.trim().split(" ")[0] || "";
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
  const message = `${greeting} Infelizmente seu pedido ${formattedId} precisou ser cancelado.`;

  assert.equal(message, "Olá, Danilo! Infelizmente seu pedido #E625 precisou ser cancelado.");
});

test("cancellation message template handles customer without name", () => {
  const orderId = "11112222-3333-4444-5555-666677778888";
  const formattedId = formatOrderNumber(orderId);
  const customerName = null as string | null;
  const firstName = customerName?.trim().split(" ")[0] || "";
  const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
  const message = `${greeting} Infelizmente seu pedido ${formattedId} precisou ser cancelado.`;

  assert.equal(message, "Olá! Infelizmente seu pedido #8888 precisou ser cancelado.");
});

test("SendChunkedParams accepts optional sender HUMAN or BOT", () => {
  const paramsHuman: SendChunkedParams = {
    phone: "5531999999999",
    customerId: "cust-1",
    tenantId: "tenant-1",
    customerName: "Danilo",
    isHumanAttending: false,
    text: "Pedido cancelado.",
    sender: "HUMAN",
  };

  const paramsBot: SendChunkedParams = {
    phone: "5531999999999",
    customerId: "cust-1",
    tenantId: "tenant-1",
    customerName: "Danilo",
    isHumanAttending: false,
    text: "Pedido em preparo.",
    sender: "BOT",
  };

  const paramsDefault: SendChunkedParams = {
    phone: "5531999999999",
    customerId: "cust-1",
    tenantId: "tenant-1",
    customerName: "Danilo",
    isHumanAttending: false,
    text: "Pedido saiu para entrega.",
  };

  assert.equal(paramsHuman.sender, "HUMAN");
  assert.equal(paramsBot.sender, "BOT");
  assert.equal(paramsDefault.sender, undefined);
});

