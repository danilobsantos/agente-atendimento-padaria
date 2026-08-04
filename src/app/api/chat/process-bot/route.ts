import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evolutionGo } from "@/lib/services/evolution-go";
import { SessionService } from "@/lib/services/session.service";
import { MessageBuffer } from "@/lib/bot/message-buffer";
import { IntentRouter } from "@/lib/bot/intent-router";
import { LLMAgent } from "@/lib/bot/llm-agent";
import { sendChunkedResponse } from "@/lib/bot/message-sender";
import { OrdersService } from "@/lib/services/orders.service";
import { ProductsService } from "@/lib/services/products.service";
import { BotState } from "@/lib/types/session";

export async function POST(request: Request) {
  try {
    const { customerId, message } = await request.json();

    if (!customerId || !message) {
      return NextResponse.json({ error: "customerId and message are required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        tenant: { include: { botSetting: true } },
      },
    });

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const botSetting = customer.tenant.botSetting;
    if (!botSetting || !botSetting.isActive || customer.isHumanAttending) {
      return NextResponse.json({ status: "skipped", reason: "bot_inactive_or_human_handover" });
    }

    if (!botSetting.llmApiKey) {
      return NextResponse.json({ error: "LLM API Key is not configured" }, { status: 400 });
    }

    // 1. Debounce / Message Buffer
    // This prevents multiple LLM calls if the user sends 3 fast messages. 
    // It locks and queues them, then the single locked process consumes the queue.
    const isFirst = await MessageBuffer.pushMessage(customer.tenantId, customerId, message);
    if (!isFirst) {
      return NextResponse.json({ status: "queued", reason: "debounce_active" });
    }

    // Wait a brief moment to allow rapid subsequent messages to queue up
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Consume all messages that arrived during the debounce window
    const queuedMessages = await MessageBuffer.consumeMessages(customer.tenantId, customerId);
    if (queuedMessages.length === 0) {
      await MessageBuffer.releaseLock(customer.tenantId, customerId);
      return NextResponse.json({ status: "empty_queue" });
    }

    const fullMessage = queuedMessages.join("\\n");
    await evolutionGo.sendPresence(customer.phone, "composing").catch(() => {});

    // 2. Load Session from Redis (TTL from admin panel)
    SessionService.setTTL(botSetting.sessionTimeout ?? 1800);
    const session = await SessionService.getSession(customer.tenantId, customerId, customer.phone, customer.activeOrderId || undefined);

    // 3. Intent Router (Business Rules bypass)
    const routerResponse = await IntentRouter.route(fullMessage, session);
    
    let finalBotText = routerResponse.reply || "";

    if (!routerResponse.bypassed) {
      // 4. Fallback to LLM if Intent Router didn't handle it
      // First, get products for context if needed (we can provide UUIDs to the LLM via prompt if we wanted, but avoiding for token size)
      // Actually, we'll append a slimmed product list to the user's prompt just in case, but cached.
      const products = await ProductsService.getProducts(customer.tenantId);
      
      // Build a compact menu with short numeric IDs to save tokens
      // Each UUID is 36 chars; a short ID is 1-3 chars — saving ~33 chars per product
      const idMap = new Map<string, string>(); // shortId -> UUID
      const menuLines = products.map((p, i) => {
        const shortId = String(i + 1);
        idMap.set(shortId, p.id);
        return `${shortId}.${p.name} R$${p.price}`;
      });
      
      const contextualMessage = `MENU:\n${menuLines.join("\n")}\n\nUSER:${fullMessage}`;

      const agentResponse = await LLMAgent.processMessage(
        session,
        contextualMessage,
        {
          provider: botSetting.llmProvider,
          apiKey: botSetting.llmApiKey,
          model: botSetting.llmModel,
          maxOutputTokens: botSetting.maxOutputTokens,
          messageContextLimit: botSetting.messageContextLimit,
          temperature: botSetting.temperature ?? 0.7,
          systemPrompt: botSetting.systemPrompt || "Você é um assistente virtual.",
        }
      );

      finalBotText = agentResponse.message;

      // 1. Process customer info if present
      if (agentResponse.customerInfo) {
        const ignoreValues = ["not provided", "não informado", "não providenciado", "null", ""];
        
        const nameVal = agentResponse.customerInfo.name?.trim() || "";
        if (nameVal && !ignoreValues.includes(nameVal.toLowerCase())) {
          session.customer.name = nameVal;
        }
        
        const addrVal = agentResponse.customerInfo.address?.trim() || "";
        if (addrVal && !ignoreValues.includes(addrVal.toLowerCase())) {
          session.customer.address = addrVal;
        }
        
        const payVal = agentResponse.customerInfo.payment?.trim() || "";
        if (payVal && !ignoreValues.includes(payVal.toLowerCase())) {
          session.payment = payVal;
        }
      }

      // 2. Map short IDs back to UUIDs before executing order logic (allowed for any intent)
      if (agentResponse.products && agentResponse.products.length > 0) {
        const mappedProducts = agentResponse.products.map(p => ({
          ...p,
          id: idMap.get(p.id) || p.id, // Resolve short ID to UUID, fallback to original
        }));
        const result = await OrdersService.updateOrderItems(session, mappedProducts);
        // Only append item addition result if not confirming order, to avoid duplicate/messy output
        if (agentResponse.intent !== "confirmar_pedido") {
          finalBotText += `\n\n${result}`;
        }
      }

      // 3. Handle specific intents
      if (agentResponse.intent === "confirmar_pedido") {
        try {
          const orderId = await OrdersService.finalizeOrder(session);
          session.state = BotState.START;
          session.activeOrderId = orderId;
          const { formatOrderNumber } = await import("@/lib/utils/format-order");
          // We DO NOT clear the session here anymore. We keep it alive so the context window remains.
          finalBotText += `\n\n*(Pedido ${formatOrderNumber(orderId)} gerado com sucesso!)*`;
        } catch (e: any) {
          console.error("[Bot Process] Error finalizing order:", e);
          finalBotText = `Ops! Não consegui finalizar o seu pedido: ${e.message}\nPor favor, informe os dados que faltam para que eu possa concluir.`;
        }
      } else if (agentResponse.intent === "cancelar_pedido") {
        session.state = BotState.CANCELLED;
        if (session.activeOrderId) {
          const existingOrder = await prisma.order.findUnique({
            where: { id: session.activeOrderId },
            select: { status: true }
          });
          if (existingOrder && ["PENDING", "CONFIRMED", "PREPARING"].includes(existingOrder.status)) {
            await prisma.order.update({
              where: { id: session.activeOrderId },
              data: { status: "CANCELLED" }
            });
            await prisma.customer.update({
              where: { id: session.customerId },
              data: { activeOrderId: null }
            });
            const { redisPub } = await import("@/lib/redis");
            await redisPub.publish(
              `tenant:${session.tenantId}:order`,
              JSON.stringify({ orderId: session.activeOrderId, status: "CANCELLED", event: "ORDER_STATUS_UPDATED" })
            );
          }
        }
        await SessionService.clearSession(session.tenantId, session.customerId);
      }
    }

    // 5. Append interaction to context
    await SessionService.appendContext(session, "user", fullMessage);
    await SessionService.appendContext(session, "assistant", finalBotText);

    // Release Lock
    await MessageBuffer.releaseLock(customer.tenantId, customerId);

    // 6. Send response (auto-splits long messages with typing delays)
    await sendChunkedResponse({
      phone: customer.phone,
      customerId: customer.id,
      tenantId: customer.tenantId,
      customerName: customer.name || customer.phone,
      isHumanAttending: customer.isHumanAttending,
      text: finalBotText,
    });

    await evolutionGo.sendPresence(customer.phone, "paused").catch(() => {});

    return NextResponse.json({ status: "success", response: finalBotText });
  } catch (error: any) {
    console.error("[Bot Process] Error:", error);
    try {
      const fs = require("fs");
      const path = require("path");
      fs.writeFileSync(
        path.join(process.cwd(), "bot-error.log"),
        `${new Date().toISOString()}\\nError: ${error?.message || error}\\nStack: ${error?.stack || "no-stack"}\\n`,
        { flag: "a" }
      );
    } catch (fsErr) {
      console.error("Failed to write bot error log:", fsErr);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
