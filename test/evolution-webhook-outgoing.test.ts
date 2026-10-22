import "dotenv/config";
import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { redisPub, redisKey } from "../src/lib/redis";
import { POST } from "../src/app/api/webhooks/evolution/route";

describe("Evolution Webhook - External Device Message Synchronization", () => {
  let tenantId: string;
  const testPhone = "5535999990001";

  before(async () => {
    // Setup or find an active tenant
    const tenant = await prisma.tenant.findFirst({ where: { active: true } });
    if (!tenant) {
      const createdTenant = await prisma.tenant.create({
        data: {
          slug: "padaria-teste-sync",
          name: "Padaria Teste External Sync",
          cnpj: "12.345.678/0001-90",
          active: true,
        },
      });
      tenantId = createdTenant.id;
    } else {
      tenantId = tenant.id;
    }
  });

  beforeEach(async () => {
    // Clean up test customer and messages
    const customer = await prisma.customer.findFirst({
      where: { tenantId, phone: testPhone },
    });
    if (customer) {
      await prisma.chatMessage.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    }
  });

  test("ignores fromMe message if message ID is registered in Redis (self-sent by Bot/Panel)", async () => {
    const msgId = "TEST_MSG_SELF_123";
    await redisPub.set(redisKey("sent_msg", msgId), "1", "EX", 60);

    const payload = {
      event: "Message",
      data: {
        key: {
          id: msgId,
          remoteJid: `${testPhone}@s.whatsapp.net`,
          fromMe: true,
        },
        Info: {
          Id: msgId,
          Chat: `${testPhone}@s.whatsapp.net`,
          IsFromMe: true,
        },
        Message: {
          conversation: "Mensagem enviada pelo bot ou painel",
        },
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.status, "ignored_self_sent");

    // Verify no customer was created
    const customer = await prisma.customer.findFirst({
      where: { tenantId, phone: testPhone },
    });
    assert.equal(customer, null);
  });

  test("captures fromMe message from external WhatsApp device, saves as HUMAN and enables isHumanAttending", async () => {
    const externalMsgId = "EXT_MSG_PHONE_APP_999";
    const externalText = "Olá, estou respondendo diretamente do celular!";

    const payload = {
      event: "Message",
      data: {
        key: {
          id: externalMsgId,
          remoteJid: `${testPhone}@s.whatsapp.net`,
          fromMe: true,
        },
        Info: {
          Id: externalMsgId,
          Chat: `${testPhone}@s.whatsapp.net`,
          IsFromMe: true,
        },
        Message: {
          conversation: externalText,
        },
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.status, "captured_external_human");

    // Verify customer was created with isHumanAttending = true
    const customer = await prisma.customer.findFirst({
      where: { tenantId, phone: testPhone },
      include: { chatMessages: true },
    });

    assert.ok(customer, "Customer should be created");
    assert.equal(customer.isHumanAttending, true, "isHumanAttending must be true");
    assert.equal(customer.chatMessages.length, 1);
    assert.equal(customer.chatMessages[0].sender, "HUMAN");
    assert.equal(customer.chatMessages[0].content, externalText);
  });

  test("defensive deduplication ignores identical fromMe message sent within last 10s", async () => {
    // 1. Create a customer with a recent message
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        phone: testPhone,
        isHumanAttending: false,
      },
    });

    const duplicateText = "Texto idêntico recente";
    await prisma.chatMessage.create({
      data: {
        customerId: customer.id,
        sender: "HUMAN",
        content: duplicateText,
      },
    });

    // 2. Incoming fromMe webhook with different ID but same text
    const payload = {
      event: "Message",
      data: {
        key: {
          id: "ANOTHER_ID_SAME_TEXT",
          remoteJid: `${testPhone}@s.whatsapp.net`,
          fromMe: true,
        },
        Info: {
          Id: "ANOTHER_ID_SAME_TEXT",
          Chat: `${testPhone}@s.whatsapp.net`,
          IsFromMe: true,
        },
        Message: {
          conversation: duplicateText,
        },
      },
    };

    const req = new Request("http://localhost:3000/api/webhooks/evolution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.status, "ignored_recent_duplicate");

    // Message count should still be 1
    const count = await prisma.chatMessage.count({ where: { customerId: customer.id } });
    assert.equal(count, 1);
  });

  after(async () => {
    await prisma.$disconnect();
    redisPub.disconnect();
  });
});
