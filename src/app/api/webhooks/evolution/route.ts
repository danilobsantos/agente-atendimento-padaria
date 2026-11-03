import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPhoneLookupVariants } from "@/lib/utils/company";
import { resolveCustomerPhone } from "@/lib/utils/whatsapp";
import { botSecret } from "@/lib/utils/api-auth";

// Janela em que o bot fica quieto depois que um humano responde pelo celular.
// Antes disso o silêncio era permanente e o bot nunca voltava a atender.
const HUMAN_REPLY_SILENCE_MS = 30 * 60 * 1000;

// Evolution Go Webhook - Receives incoming WhatsApp messages
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Evolution Go event for received messages; keep the legacy names as a defensive fallback.
    if (
      payload.event !== "Message" &&
      payload.event !== "messages.upsert" &&
      payload.event !== "MESSAGE"
    ) {
      return NextResponse.json({ status: "ignored" });
    }

    // Evolution Go wraps the message in data.Info (metadata) and data.Message (content).
    const data = payload.data ?? {};
    const info = data.Info ?? {};
    const message = data.Message ?? data.message ?? {};

    const isFromMe = Boolean(info.IsFromMe ?? data.key?.fromMe);
    const messageId = String(data.key?.id || info.Id || info.id || "");

    // If sent from our own system (Bot or Admin Panel), it was cached in Redis -> ignore to prevent duplicate echo
    if (isFromMe && messageId) {
      try {
        const { redisPub, redisKey } = await import("@/lib/redis");
        const wasSentByUs = await redisPub.exists(redisKey("sent_msg", messageId));
        if (wasSentByUs) {
          return NextResponse.json({ status: "ignored_self_sent" });
        }
      } catch (redisErr) {
        console.error("[Webhook] Redis check for sent_msg failed:", redisErr);
      }
    }

    // Dedupe de inbound por id da mensagem: a Evolution reentrega o mesmo evento
    // em retry, o que criava ChatMessage duplicado e disparava um segundo turno
    // do bot (com o cliente sendo respondido duas vezes).
    if (messageId) {
      try {
        const { redisPub, redisKey } = await import("@/lib/redis");
        const first = await redisPub.set(redisKey("inbound", "msg", messageId), "1", "EX", 3600, "NX");
        if (first !== "OK") {
          return NextResponse.json({ status: "ignored_duplicate" });
        }
      } catch (redisErr) {
        // Redis fora: segue o fluxo (duplicar é melhor que perder a mensagem).
        console.error("[Webhook] Redis dedupe failed:", redisErr);
      }
    }

    const phone = resolveCustomerPhone(data, info);
    if (!phone) {
      console.warn("[Webhook] Skipping message: no valid phone found (likely @lid-only event):", {
        chat: info.Chat ?? data.key?.remoteJid,
        sender: info.Sender ?? data.sender,
      });
      return NextResponse.json({ status: "skipped_no_phone" });
    }

    if (phone.length > 13) {
      console.warn(`[Webhook] Skipping non-standard phone length: ${phone}`);
      return NextResponse.json({ status: "skipped_invalid_phone" });
    }

    // Extract text content (supports conversation, extendedTextMessage, and button/list replies)
    const text =
      message.conversation ||
      message.extendedTextMessage?.text ||
      message.buttonsResponseMessage?.selectedDisplayText ||
      message.buttonsResponseMessage?.selectedButtonId ||
      message.templateButtonReplyMessage?.selectedId ||
      message.listResponseMessage?.title ||
      "";

    if (!text) {
      return NextResponse.json({ status: "no_text" });
    }

    // Resolve tenant strictly by Evolution instance name. Sem fallback para o
    // "primeiro tenant ativo": com um fallback, qualquer POST sem instância
    // válida injetava mensagem e criava cliente no tenant errado.
    const instanceName =
      payload.instance ||
      payload.instanceName ||
      payload.data?.instance ||
      payload.data?.instanceName ||
      payload.data?.Info?.InstanceName;

    let tenant = null;
    if (instanceName && typeof instanceName === "string") {
      const setting = await prisma.botSetting.findFirst({
        where: {
          evolutionInstanceName: instanceName,
          tenant: { active: true },
        },
        include: { tenant: true },
      });
      if (setting?.tenant) {
        tenant = setting.tenant;
      }
    }

    if (!tenant) {
      console.warn(`[Webhook] Instância não reconhecida: ${String(instanceName)}`);
      return NextResponse.json({ error: "Unknown instance" }, { status: 404 });
    }

    // Extract customer pushName (only relevant for incoming user messages)
    const pushName = info.PushName || payload.data?.pushName || payload.pushName || null;

    // Find existing customer by phone or phone variants (e.g. with/without 55, 8 vs 9 digits)
    const phoneVariants = getPhoneLookupVariants(phone);
    let customer = await prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        phone: { in: phoneVariants },
      },
    });

    if (customer) {
      if (pushName && !customer.name && !isFromMe) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { name: pushName },
        });
      }
    } else {
      customer = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          phone,
          name: isFromMe ? null : pushName,
        },
      });
    }

    // Handle messages sent from other devices (WhatsApp mobile app, WhatsApp Web)
    if (isFromMe) {
      // Defensive deduplication check: check if identical message was stored in the last 10 seconds
      const recentDuplicate = await prisma.chatMessage.findFirst({
        where: {
          customerId: customer.id,
          content: text,
          createdAt: {
            gte: new Date(Date.now() - 10000),
          },
        },
      });

      if (recentDuplicate) {
        return NextResponse.json({ status: "ignored_recent_duplicate" });
      }

      // Save message as HUMAN (sent from official WhatsApp device by staff)
      const chatMessage = await prisma.chatMessage.create({
        data: {
          customerId: customer.id,
          sender: "HUMAN",
          content: text,
        },
      });

      // Humano respondeu pelo celular: silencia o bot por uma janela, sem
      // marcar `isHumanAttending` (esse flag é do botão "assumir" do painel).
      // Antes, este trecho silenciava o bot para sempre (B5).
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { botSilencedUntil: new Date(Date.now() + HUMAN_REPLY_SILENCE_MS) },
      });

      // Publish event to Redis for WebSocket broadcast (chat message & customer status update)
      const { redisChannel, redisPub } = await import("@/lib/redis");
      await redisPub.publish(
        redisChannel("tenant", tenant.id, "message"),
        JSON.stringify({
          ...chatMessage,
          customerName: customer.name || customer.phone,
          phone: customer.phone,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      await redisPub.publish(
        redisChannel("tenant", tenant.id, "customer"),
        JSON.stringify({
          customerId: customer.id,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      return NextResponse.json({
        status: "captured_external_human",
        customerId: customer.id,
        messageId: chatMessage.id,
      });
    }

    // Save standard incoming message from customer
    const chatMessage = await prisma.chatMessage.create({
      data: {
        customerId: customer.id,
        sender: "USER",
        content: text,
      },
    });

    // Publish event to Redis for WebSocket broadcast
    const { redisChannel, redisPub } = await import("@/lib/redis");
    await redisPub.publish(
      redisChannel("tenant", tenant.id, "message"),
      JSON.stringify({
        ...chatMessage,
        customerName: customer.name || customer.phone,
        phone: customer.phone,
        isHumanAttending: customer.isHumanAttending,
      })
    );

    // Trigger Bot Pipeline asynchronously (debounce and processing happens there)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${appUrl}/api/chat/process-bot`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": botSecret() },
      body: JSON.stringify({ customerId: customer.id, message: text }),
    }).catch((err) => console.error("Error triggering bot pipeline:", err));

    return NextResponse.json({ status: "received", customerId: customer.id });
  } catch (error) {
    console.error("[Webhook] Error processing message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
