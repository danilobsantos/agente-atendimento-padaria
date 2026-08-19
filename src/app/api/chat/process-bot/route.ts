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
import type { LLMService } from "@/lib/types/llm";

export interface BotRouteDeps {
  llmService?: LLMService;
  send?: typeof sendChunkedResponse;
  debounceMs?: number;
  // Next.js typed-routes passes `context: { params }` here; only used for type-compat.
  params?: unknown;
}

// LLM-driven finalization guard: mirror the IntentRouter's explicit-confirm
// words so a drift (LLM asks for confirmation but labels intent confirmar_pedido)
// can't ship the order before the customer actually confirms.
function isExplicitConfirmation(rawMessage: string): boolean {
  const text = rawMessage.trim().toLowerCase();
  if (/\bn(ao)?o\b/.test(text)) return false;
  if (text === "sim" || text === "ok" || text === "pode") return true;
  return /\b(confirmar|confirmo|pode mandar|pode ser|pode confirmar|t[áa] certo|manda ver|isso mesmo)\b/.test(text);
}

const ENCOMENDA_RE = /\bencomend\w*\b/i;

function isEncomendaRequest(message: string): boolean {
  return ENCOMENDA_RE.test(message.trim());
}

async function triggerEncomendaHandover(customer: {
  id: string;
  tenantId: string;
  name: string | null;
  phone: string;
}): Promise<string> {
  await prisma.customer.update({
    where: { id: customer.id },
    data: { isHumanAttending: true },
  });
  const { redisChannel, redisPub } = await import("@/lib/redis");
  await redisPub.publish(
    redisChannel("tenant", customer.tenantId, "customer"),
    JSON.stringify({ customerId: customer.id, isHumanAttending: true })
  );
  // Reinforce the sidebar badge, then alert staff via a PANEL TOAST (a
  // dedicated "notification" event), NOT a message in the customer chat.
  await redisPub.publish(
    redisChannel("tenant", customer.tenantId, "notification"),
    JSON.stringify({
      type: "encomenda",
      customerId: customer.id,
      customerName: customer.name || customer.phone,
      phone: customer.phone,
      message: "Solicitou encomenda — atendimento humano necessário.",
    })
  );
  return "Perfeito! Vou encaminhar para um atendente que vai entender melhor o que você precisa. Só um instante 😊";
}

export async function POST(request: Request, deps: BotRouteDeps = {}) {
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
    const debounceSeconds = botSetting.debounceSeconds ?? 2;
    // Lock TTL must outlive the debounce wait + processing (releaseLock clears it on normal exit)
    const isFirst = await MessageBuffer.pushMessage(customer.tenantId, customerId, message, Math.max(3, debounceSeconds + 15));
    if (!isFirst) {
      return NextResponse.json({ status: "queued", reason: "debounce_active" });
    }

    // Wait a brief moment to allow rapid subsequent messages to queue up
    await new Promise((resolve) => setTimeout(resolve, deps.debounceMs ?? debounceSeconds * 1000));

    // Consume all messages that arrived during the debounce window
    const queuedMessages = await MessageBuffer.consumeMessages(customer.tenantId, customerId);
    if (queuedMessages.length === 0) {
      await MessageBuffer.releaseLock(customer.tenantId, customerId);
      return NextResponse.json({ status: "empty_queue" });
    }

    const fullMessage = queuedMessages.join("\\n");
    await evolutionGo.sendPresence(customer.phone, "composing").catch(() => { });

    // 2. Load Session from Redis (TTL from admin panel)
    SessionService.setTTL(botSetting.sessionTimeout ?? 1800);
    const session = await SessionService.getSession(customer.tenantId, customerId, customer.phone, customer.activeOrderId || undefined);
    if (customer.name && !session.customer.name) {
      session.customer.name = customer.name;
    }

    // Only classify delivery/pickup/order-type in the initial messages of the conversation
    const isInitial = session.state === BotState.START || session.state === BotState.SHOW_MENU;

    // 3. Intent Router (Business Rules bypass)
    const routerResponse = await IntentRouter.route(fullMessage, session);

    let finalBotText = routerResponse.reply || "";

    if (!routerResponse.bypassed) {
      // Encomenda é decisão determinística (palavra-chave), não depende do LLM
      // classificar orderType="ENCOMENDA". Detectada já no início → handover humano.
      if (isInitial && isEncomendaRequest(fullMessage)) {
        finalBotText = await triggerEncomendaHandover(customer);
      } else {
        // 4. Fallback to LLM if Intent Router didn't handle it.
        // The LLM uses the "consultar_cardapio" tool to look up products/prices on demand
        // (no full menu is injected into every call). We still build a full-catalog idMap
        // (shortId -> UUID) as a fallback so any product the LLM references resolves.
        const products = await ProductsService.getProducts(customer.tenantId);
        const idMap = new Map<string, string>();
        products.forEach((p, i) => idMap.set(String(i + 1), p.id));

        const menuUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        // Build a short-id listing of the current cart so the LLM can echo the
        // full cart back in "products" (same index+1 scheme as idMap above).
        const uuidToShort = new Map<string, string>();
        products.forEach((p, i) => uuidToShort.set(p.id, String(i + 1)));
        const cartDescription = session.order.items
          .map((it) => {
            const short = uuidToShort.get(it.productId) ?? "?";
            const extras = it.additionalItems && it.additionalItems.length > 0
              ? ` | adicionais: ${it.additionalItems.map(a => `${a.name}(+R$${a.price.toFixed(2)})`).join(", ")}`
              : "";
            return `${short}. ${it.name} x${it.quantity}${it.notes ? ` (${it.notes})` : ""}${extras}`;
          })
          .join("\n");

        const { response: agentResponse, idMap: agentIdMap } = await LLMAgent.processMessage(
          session,
          fullMessage,
          {
            provider: botSetting.llmProvider,
            apiKey: botSetting.llmApiKey,
            model: botSetting.llmModel,
            maxOutputTokens: botSetting.maxOutputTokens,
            messageContextLimit: botSetting.messageContextLimit,
            temperature: botSetting.temperature ?? 0.7,
            ...(botSetting.thinkingConfig && { thinkingConfig: botSetting.thinkingConfig }),
            systemPrompt: [
              botSetting.systemPrompt || "Você é um assistente virtual.",
              customer.name ? `Nome do cliente (já cadastrado/informado): ${customer.name}. NÃO pergunte o nome novamente.` : "",
            ].filter(Boolean).join("\n"),
            menuUrl,
            cartDescription,
          },
          { llmService: deps.llmService }
        );

        // Merge the agent's tool-resolved IDs over the full-catalog fallback
        for (const [shortId, uuid] of agentIdMap) idMap.set(shortId, uuid);

        finalBotText = agentResponse.message;

        // Order type: persist DELIVERY/PICKUP into the session
        if (agentResponse.orderType === "PICKUP" || agentResponse.orderType === "DELIVERY") {
          session.orderType = agentResponse.orderType;
        }

        // ENCOMENDA at conversation start → hand over to a human + notify panel
        if (isInitial && agentResponse.orderType === "ENCOMENDA") {
          finalBotText = await triggerEncomendaHandover(customer);
        } else {
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

          // 2. Map short IDs back to UUIDs before executing order logic.
          // The cart is ONLY updated on addition/tweak cycles; on a pure confirm the
          // LLM echo-returns the cart and re-applying it would double quantities.
          if (agentResponse.products
            && agentResponse.products.length > 0
            && agentResponse.intent !== "confirmar_pedido") {
            const mappedProducts = agentResponse.products.map(p => ({
              ...p,
              id: idMap.get(p.id) || p.id, // Resolve short ID to UUID, fallback to original
            }));
            // Items are added silently: confirmation appears only in the final order summary,
            // never as a machine line after each addition. A stale active order
            // (DISPATCHED/READY/DELIVERED/CANCELLED) is released internally, so items
            // simply start a new cart instead of being refused.
            await OrdersService.updateOrderItems(session, mappedProducts);
          }

          // 3. Handle specific intents
          if (agentResponse.intent === "confirmar_pedido" && !isExplicitConfirmation(fullMessage)) {
            // LLM drifted: asked for confirmation but labeled the intent confirmar_pedido.
            // Send the summary/question as-is; do NOT finalize the order.
            console.warn("[Bot Process] Intent confirmar_pedido sem confirmação explícita — pedido não finalizado.");
          } else if (agentResponse.intent === "confirmar_pedido") {
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
                const { redisChannel, redisPub } = await import("@/lib/redis");
                await redisPub.publish(
                  redisChannel("tenant", session.tenantId, "order"),
                  JSON.stringify({ orderId: session.activeOrderId, status: "CANCELLED", event: "ORDER_STATUS_UPDATED" })
                );
              }
            }
            await SessionService.clearSession(session.tenantId, session.customerId);
          }
        } // else: normal bot flow (skip order processing for ENCOMENDA)
      } // else: caminho LLM (encomenda por palavra-chave já tratada acima)
    }

    // 5. Append interaction to context
    const ctxLimit = Math.max(10, (botSetting.messageContextLimit ?? 10) * 2);
    await SessionService.appendContext(session, "user", fullMessage, ctxLimit);
    await SessionService.appendContext(session, "assistant", finalBotText, ctxLimit);

    // Release Lock
    await MessageBuffer.releaseLock(customer.tenantId, customerId);

    // 6. Send response (auto-splits long messages with typing delays)
    await (deps.send ?? sendChunkedResponse)({
      phone: customer.phone,
      customerId: customer.id,
      tenantId: customer.tenantId,
      customerName: customer.name || customer.phone,
      isHumanAttending: customer.isHumanAttending,
      text: finalBotText,
    });

    await evolutionGo.sendPresence(customer.phone, "paused").catch(() => { });

    return NextResponse.json({ status: "success", response: finalBotText });
  } catch (error: any) {
    console.error("[Bot Process] Error:", error);
    if (process.env.NODE_ENV !== "test") {
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
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
