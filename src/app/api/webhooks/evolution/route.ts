import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPhoneLookupVariants, normalizePhone } from "@/lib/utils/company";

function extractPhoneFromJid(jid: unknown): string | null {
  if (!jid || typeof jid !== "string") return null;
  const userPart = jid.split("@")[0].split(":")[0];
  const digits = userPart.replace(/\D/g, "");
  return digits || null;
}

function resolveCustomerPhone(data: any, info: any): string | null {
  // In WhatsApp / Evolution Go (whatsmeow), private chats sometimes have a LID (e.g. 123119649996807...@lid)
  // in Info.Chat or key.remoteJid, while the real phone number is provided in Info.Sender, Info.SenderAlt,
  // data.sender, data.key.participant, data.key.remoteJidAlt, etc.
  const candidateJids: unknown[] = [
    info.SenderAlt,
    info.Sender,
    data.senderAlt,
    data.sender,
    data.key?.remoteJidAlt,
    data.key?.participant,
    data.key?.participantPn,
    data.senderPhone,
    data.senderPn,
    info.Chat,
    data.key?.remoteJid,
  ];

  // 1. Highest priority: any candidate ending in @s.whatsapp.net
  for (const jid of candidateJids) {
    if (typeof jid === "string" && jid.includes("@s.whatsapp.net")) {
      const extracted = extractPhoneFromJid(jid);
      if (extracted) return normalizePhone(extracted);
    }
  }

  // 2. Second priority: standard phone length (10 to 14 digits, typically Brazilian 12-13 digits)
  // LIDs are typically 15+ digits (like 123119649996807...)
  for (const jid of candidateJids) {
    if (typeof jid === "string") {
      const extracted = extractPhoneFromJid(jid);
      if (extracted && extracted.length >= 10 && extracted.length <= 14) {
        return normalizePhone(extracted);
      }
    }
  }

  // 3. Fallback: use whatever identifier is in Chat / remoteJid / Sender
  const fallback = info.Chat ?? data.key?.remoteJid ?? info.Sender ?? data.sender;
  const fallbackDigits = extractPhoneFromJid(fallback);
  return fallbackDigits ? normalizePhone(fallbackDigits) : null;
}

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

    const phone = resolveCustomerPhone(data, info);
    if (!phone) {
      return NextResponse.json({ status: "no_jid" });
    }

    if (phone.length > 14) {
      console.warn(`[Webhook] Skipping LID-only phone: ${phone}`);
      return NextResponse.json({ status: "skipped_lid" });
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

    // Find existing customer by phone or phone variants (e.g. with/without 55, 8 vs 9 digits)
    const phoneVariants = getPhoneLookupVariants(phone);
    let customer = await prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        phone: { in: phoneVariants },
      },
    });

    if (customer) {
      if (pushName && !customer.name) {
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
          name: pushName,
        },
      });
    }

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
