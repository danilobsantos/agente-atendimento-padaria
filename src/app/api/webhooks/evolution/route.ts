import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Ignore messages sent by us
    if (info.IsFromMe ?? data.key?.fromMe) {
      return NextResponse.json({ status: "ignored" });
    }

    const remoteJid = info.Chat ?? data.key?.remoteJid;
    if (!remoteJid) {
      return NextResponse.json({ status: "no_jid" });
    }

    // Extract phone number (remove @s.whatsapp.net suffix)
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

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

    // For now, use the first active tenant (single-tenant mode)
    // In SaaS mode, this would be resolved by the Evolution instance → tenant mapping
    const tenant = await prisma.tenant.findFirst({
      where: { active: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "No active tenant" }, { status: 404 });
    }

    // Extract customer pushName
    const pushName = info.PushName || payload.data?.pushName || payload.pushName || null;

    // Find or create customer
    const customer = await prisma.customer.upsert({
      where: {
        tenantId_phone: {
          tenantId: tenant.id,
          phone,
        },
      },
      update: {
        ...(pushName && { name: pushName }),
      },
      create: {
        tenantId: tenant.id,
        phone,
        name: pushName,
      },
    });

    // Save the incoming message
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customer.id, message: text }),
    }).catch(err => console.error("Error triggering bot pipeline:", err));

    return NextResponse.json({ status: "received", customerId: customer.id });
  } catch (error) {
    console.error("[Webhook] Error processing message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
