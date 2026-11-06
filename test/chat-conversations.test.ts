import { test } from "node:test";
import assert from "node:assert/strict";

interface MockChatMessage {
  id: string;
  sender: "USER" | "BOT" | "HUMAN";
  createdAt: Date;
}

interface MockCustomer {
  id: string;
  name: string;
  isHumanAttending: boolean;
  lastReadAt: Date | null;
  messages: MockChatMessage[];
}

/**
 * Pure business logic function mimicking the unread count calculation in SQL / API
 */
function computeUnreadCount(customer: MockCustomer): number {
  const lastReadTime = customer.lastReadAt ? customer.lastReadAt.getTime() : 0;

  // Find most recent reply from BOT or HUMAN
  let lastReplyTime = 0;
  for (const m of customer.messages) {
    if (m.sender === "BOT" || m.sender === "HUMAN") {
      const t = m.createdAt.getTime();
      if (t > lastReplyTime) {
        lastReplyTime = t;
      }
    }
  }

  // Count USER messages created after both lastReadAt and lastReplyTime
  const threshold = Math.max(lastReadTime, lastReplyTime);
  return customer.messages.filter(
    (m) => m.sender === "USER" && m.createdAt.getTime() > threshold
  ).length;
}

test("unreadCount is 0 when bot has already responded to user message", () => {
  const customer: MockCustomer = {
    id: "c1",
    name: "Maria",
    isHumanAttending: false,
    lastReadAt: null,
    messages: [
      { id: "m1", sender: "USER", createdAt: new Date("2026-11-06T14:00:00Z") },
      { id: "m2", sender: "BOT", createdAt: new Date("2026-11-06T14:00:05Z") },
    ],
  };

  assert.equal(computeUnreadCount(customer), 0);
});

test("unreadCount is 0 when human operator has already responded", () => {
  const customer: MockCustomer = {
    id: "c2",
    name: "João",
    isHumanAttending: true,
    lastReadAt: null,
    messages: [
      { id: "m1", sender: "USER", createdAt: new Date("2026-11-06T14:00:00Z") },
      { id: "m2", sender: "HUMAN", createdAt: new Date("2026-11-06T14:02:00Z") },
    ],
  };

  assert.equal(computeUnreadCount(customer), 0);
});

test("unreadCount counts all unanswered user messages when neither bot nor human responded", () => {
  const customer: MockCustomer = {
    id: "c3",
    name: "Lucas",
    isHumanAttending: true,
    lastReadAt: null,
    messages: [
      { id: "m1", sender: "USER", createdAt: new Date("2026-11-06T14:10:00Z") },
      { id: "m2", sender: "USER", createdAt: new Date("2026-11-06T14:11:00Z") },
      { id: "m3", sender: "USER", createdAt: new Date("2026-11-06T14:12:00Z") },
    ],
  };

  assert.equal(computeUnreadCount(customer), 3);
});

test("unreadCount is 0 when human operator opened/read the conversation after user messages", () => {
  const customer: MockCustomer = {
    id: "c4",
    name: "Ana",
    isHumanAttending: true,
    lastReadAt: new Date("2026-11-06T14:15:00Z"),
    messages: [
      { id: "m1", sender: "USER", createdAt: new Date("2026-11-06T14:10:00Z") },
      { id: "m2", sender: "USER", createdAt: new Date("2026-11-06T14:12:00Z") },
    ],
  };

  assert.equal(computeUnreadCount(customer), 0);
});

test("unreadCount reflects new user messages that arrived after human read previous ones", () => {
  const customer: MockCustomer = {
    id: "c5",
    name: "Carlos",
    isHumanAttending: true,
    lastReadAt: new Date("2026-11-06T14:15:00Z"),
    messages: [
      { id: "m1", sender: "USER", createdAt: new Date("2026-11-06T14:10:00Z") },
      { id: "m2", sender: "USER", createdAt: new Date("2026-11-06T14:20:00Z") }, // after lastReadAt
    ],
  };

  assert.equal(computeUnreadCount(customer), 1);
});

test("filters (Todas | Não lidas | IA) filter conversations correctly", () => {
  const c1: MockCustomer = {
    id: "1",
    name: "Atendido por IA com resposta",
    isHumanAttending: false,
    lastReadAt: null,
    messages: [
      { id: "m1", sender: "USER", createdAt: new Date("2026-11-06T14:00:00Z") },
      { id: "m2", sender: "BOT", createdAt: new Date("2026-11-06T14:00:05Z") },
    ],
  };

  const c2: MockCustomer = {
    id: "2",
    name: "Atendido por IA com pendência",
    isHumanAttending: false,
    lastReadAt: null,
    messages: [
      { id: "m3", sender: "USER", createdAt: new Date("2026-11-06T14:30:00Z") },
    ],
  };

  const c3: MockCustomer = {
    id: "3",
    name: "Atendido por Humano com pendência",
    isHumanAttending: true,
    lastReadAt: null,
    messages: [
      { id: "m4", sender: "USER", createdAt: new Date("2026-11-06T14:35:00Z") },
    ],
  };

  const list = [
    { ...c1, unreadCount: computeUnreadCount(c1) },
    { ...c2, unreadCount: computeUnreadCount(c2) },
    { ...c3, unreadCount: computeUnreadCount(c3) },
  ];

  // Filter "all"
  assert.equal(list.length, 3);

  // Filter "unread"
  const unreadList = list.filter((c) => c.unreadCount > 0);
  assert.equal(unreadList.length, 2);
  assert.deepEqual(unreadList.map((c) => c.id), ["2", "3"]);

  // Filter "ia" (isHumanAttending === false)
  const iaList = list.filter((c) => !c.isHumanAttending);
  assert.equal(iaList.length, 2);
  assert.deepEqual(iaList.map((c) => c.id), ["1", "2"]);
});

