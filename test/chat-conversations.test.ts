import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeUniqueConversations } from "../src/lib/utils/chat-merge";

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

test("search by customer name or phone number filters conversations correctly", () => {
  interface MockSearchConversation {
    customerId: string;
    customerName: string;
    phone: string;
    isHumanAttending: boolean;
    unreadCount: number;
  }

  const convs: MockSearchConversation[] = [
    {
      customerId: "1",
      customerName: "Danilo Santos",
      phone: "+55 (11) 98765-4321",
      isHumanAttending: true,
      unreadCount: 0,
    },
    {
      customerId: "2",
      customerName: "Maria Oliveira",
      phone: "5535999887766",
      isHumanAttending: false,
      unreadCount: 2,
    },
    {
      customerId: "3",
      customerName: "Carlos Eduardo",
      phone: "(35) 91234-5678",
      isHumanAttending: false,
      unreadCount: 0,
    },
    {
      customerId: "4",
      customerName: "5535991112233", // cliente sem nome, telefone como fallback
      phone: "5535991112233",
      isHumanAttending: false,
      unreadCount: 1,
    },
  ];

  function searchFilter(list: MockSearchConversation[], query: string): MockSearchConversation[] {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const qDigits = q.replace(/\D/g, "");

    return list.filter((c) => {
      const name = (c.customerName || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const phoneDigits = phone.replace(/\D/g, "");

      const matchesName = name.includes(q);
      const matchesPhone = phone.includes(q) || (qDigits !== "" && phoneDigits.includes(qDigits));

      return matchesName || matchesPhone;
    });
  }

  // 1. Busca por nome case-insensitive
  const byName = searchFilter(convs, "danilo");
  assert.equal(byName.length, 1);
  assert.equal(byName[0].customerId, "1");

  const byPartialName = searchFilter(convs, "CARLOS");
  assert.equal(byPartialName.length, 1);
  assert.equal(byPartialName[0].customerId, "3");

  // 2. Busca por número com dígitos puros (sem máscara)
  const byDigits = searchFilter(convs, "987654321");
  assert.equal(byDigits.length, 1);
  assert.equal(byDigits[0].customerId, "1");

  // 3. Busca por número com máscara digitada
  const byMask = searchFilter(convs, "(35) 99988");
  assert.equal(byMask.length, 1);
  assert.equal(byMask[0].customerId, "2");

  // 4. Busca por cliente identificado apenas por telefone no nome
  const byPhoneOnly = searchFilter(convs, "99111");
  assert.equal(byPhoneOnly.length, 1);
  assert.equal(byPhoneOnly[0].customerId, "4");

  // 5. Busca sem resultados
  const notFound = searchFilter(convs, "Inexistente 0000");
  assert.equal(notFound.length, 0);

  // 6. Busca combinada com filtro "IA"
  const searchIa = searchFilter(convs, "35").filter((c) => !c.isHumanAttending);
  assert.equal(searchIa.length, 3);
  assert.deepEqual(searchIa.map((c) => c.customerId), ["2", "3", "4"]);
});

test("mergeUniqueConversations deduplica customerId ao anexar páginas", () => {
  const prev = [{ customerId: "a" }, { customerId: "b" }];
  const next = [{ customerId: "b" }, { customerId: "c" }];
  const result = mergeUniqueConversations(prev, next);
  assert.deepEqual(result.map((c) => c.customerId), ["a", "b", "c"]);
});

test("mergeUniqueConversations: anexar a mesma página várias vezes não gera duplicatas", () => {
  const page = [{ customerId: "a" }, { customerId: "b" }, { customerId: "c" }];
  let state: Array<{ customerId: string }> = [];
  for (let i = 0; i < 8; i++) {
    state = mergeUniqueConversations(state, page);
  }
  assert.equal(state.length, 3);
  assert.deepEqual(state.map((c) => c.customerId), ["a", "b", "c"]);
});

test("mergeUniqueConversations limpa duplicatas pré-existentes no estado", () => {
  const prev = [{ customerId: "a" }, { customerId: "a" }, { customerId: "b" }];
  const result = mergeUniqueConversations(prev, []);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((c) => c.customerId), ["a", "b"]);
});


