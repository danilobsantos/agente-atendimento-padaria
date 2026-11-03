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
import { LlmBudgetExceededError } from "@/lib/llm/runner";
import { isAuthorizedBotRequest, unauthorized } from "@/lib/utils/api-auth";
import { raiseAlert } from "@/lib/services/alert.service";
import { detectHumanRequest, detectOptOut, isExplicitConfirmation } from "@/lib/bot/guardrails/detect";
import { checkPrices, stripDeliveryPromises } from "@/lib/bot/guardrails/price-guard";
import type { LLMService } from "@/lib/types/llm";

export interface BotRouteDeps {
  llmService?: LLMService;
  send?: typeof sendChunkedResponse;
  debounceMs?: number;
  // Next.js typed-routes passes `context: { params }` here; only used for type-compat.
  params?: unknown;
}

const ENCOMENDA_RE = /\bencomend\w*\b/i;

/**
 * Guardrails determinísticos que rodam antes do LLM (custo zero de token).
 * Devolvem a resposta pronta quando assumem o turno, ou null para seguir o fluxo.
 *
 * Pedido de humano e opt-out não podem depender do modelo: se ele errar, o
 * cliente fica preso no bot ou recebe mensagem que pediu para não receber.
 */
async function handlePreLlmGuardrails(
  message: string,
  customer: { id: string; tenantId: string; name: string | null; phone: string },
): Promise<string | null> {
  if (detectHumanRequest(message)) {
    await prisma.customer.update({ where: { id: customer.id }, data: { isHumanAttending: true } });
    const { redisChannel, redisPub } = await import("@/lib/redis");
    await redisPub.publish(
      redisChannel("tenant", customer.tenantId, "customer"),
      JSON.stringify({ customerId: customer.id, isHumanAttending: true }),
    );
    await raiseAlert({
      tenantId: customer.tenantId,
      kind: "handoff",
      severity: "info",
      title: "Cliente pediu atendimento humano",
      body: message.slice(0, 500),
      refKind: "customer",
      refId: customer.id,
    });
    return "Claro! Já chamei um atendente para falar com você. Só um instante 😊";
  }

  if (detectOptOut(message)) {
    // Silenciar o bot é a única leitura segura de "para de me mandar mensagem".
    await prisma.customer.update({ where: { id: customer.id }, data: { isHumanAttending: true } });
    const { redisChannel, redisPub } = await import("@/lib/redis");
    await redisPub.publish(
      redisChannel("tenant", customer.tenantId, "customer"),
      JSON.stringify({ customerId: customer.id, isHumanAttending: true }),
    );
    await raiseAlert({
      tenantId: customer.tenantId,
      kind: "handoff",
      severity: "warn",
      title: "Cliente pediu para parar de receber mensagens",
      body: message.slice(0, 500),
      refKind: "customer",
      refId: customer.id,
    });
    return "Tudo bem! Não vou mais te enviar mensagens automáticas. Se precisar de algo, é só chamar por aqui. 🙏";
  }

  return null;
}

/** Tudo que a resposta pode legitimamente afirmar em R$. */
function allowedPriceCents(
  session: Awaited<ReturnType<typeof SessionService.getSession>>,
  products: { price: number; extras?: { price: number }[] }[],
  extraPrices: number[],
  deliveryFee: number,
): number[] {
  const cents = new Set<number>([0]);
  const add = (value: number) => {
    if (Number.isFinite(value)) cents.add(Math.round(value * 100));
  };

  for (const p of products) {
    add(p.price);
    for (const e of p.extras ?? []) add(e.price);
  }
  for (const price of extraPrices) add(price);

  for (const item of session.order.items) {
    add(item.price);
    add(item.price * item.quantity);
    let withExtras = item.price;
    for (const extra of item.additionalItems ?? []) {
      add(extra.price);
      withExtras += extra.price;
    }
    add(withExtras);
    add(withExtras * item.quantity);
  }

  const subtotal = session.order.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const fee = session.orderType === "DELIVERY" ? deliveryFee : 0;
  add(subtotal);
  add(deliveryFee);
  add(fee);
  add(subtotal + fee);

  return [...cents];
}

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
  if (!isAuthorizedBotRequest(request)) return unauthorized();

  // Tracked outside the try so a crash mid-turn can't leave the debounce lock
  // behind (with a 2-minute TTL, that would mute the customer for 2 minutes).
  let heldLock: { tenantId: string; customerId: string } | null = null;

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
    const silencedUntil = customer.botSilencedUntil;
    if (
      !botSetting ||
      !botSetting.isActive ||
      customer.isHumanAttending ||
      (silencedUntil !== null && silencedUntil > new Date())
    ) {
      return NextResponse.json({ status: "skipped", reason: "bot_inactive_or_human_handover" });
    }

    if (!botSetting.llmApiKey) {
      return NextResponse.json({ error: "LLM API Key is not configured" }, { status: 400 });
    }

    // 1. Debounce / Message Buffer
    // This prevents multiple LLM calls if the user sends 3 fast messages. 
    // It locks and queues them, then the single locked process consumes the queue.
    const debounceSeconds = botSetting.debounceSeconds ?? 2;
    // O TTL precisa cobrir o turno inteiro (até 4 rodadas de tool + retry), não
    // só a janela de debounce. releaseLock limpa no fim do turno.
    const isFirst = await MessageBuffer.pushMessage(customer.tenantId, customerId, message, 120);
    if (!isFirst) {
      return NextResponse.json({ status: "queued", reason: "debounce_active" });
    }
    heldLock = { tenantId: customer.tenantId, customerId };

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

    const guardrailReply = await handlePreLlmGuardrails(fullMessage, customer);
    const routerResponse = guardrailReply
      ? { bypassed: true, reply: guardrailReply }
      : await IntentRouter.route(fullMessage, session);

    let finalBotText = routerResponse.reply || "";
    let compressedContext = finalBotText;
    const pendingWarnings: string[] = [];

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
            temperature: botSetting.temperature ?? 0.2,
            ...(botSetting.thinkingConfig && { thinkingConfig: botSetting.thinkingConfig }),
            systemPrompt: [
              botSetting.systemPrompt || "Você é um assistente virtual.",
              customer.name ? `Nome do cliente (já cadastrado/informado): ${customer.name}. NÃO pergunte o nome novamente.` : "",
              `Taxa de entrega atual: R$ ${customer.tenant.deliveryFee?.toFixed(2) || "0.00"}.`
            ].filter(Boolean).join("\n"),
            menuUrl,
            cartDescription,
          },
          { llmService: deps.llmService, uuidToShort }
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

            // Validação anti-alucinação: remove IDs que não existem no banco
            const validProducts = mappedProducts.filter(p => products.some(prod => prod.id === p.id));
            if (validProducts.length !== mappedProducts.length) {
              console.warn(`[Bot Process] LLM inventou ${mappedProducts.length - validProducts.length} produto(s) inexistente(s). Filtrando.`);
            }

            // Items are added silently: confirmation appears only in the final order summary,
            // never as a machine line after each addition. A stale active order
            // (DISPATCHED/READY/DELIVERED/CANCELLED) is released internally, so items
            // simply start a new cart instead of being refused.
            const orderResult = await OrdersService.updateOrderItems(session, validProducts);
            pendingWarnings.push(...orderResult.warnings);
          }

          // 3. Handle specific intents
          if (agentResponse.intent === "confirmar_pedido" && !isExplicitConfirmation(fullMessage)) {
            // LLM drifted: asked for confirmation but labeled the intent confirmar_pedido.
            // Send the summary/question as-is; do NOT finalize the order.
            console.warn("[Bot Process] Intent confirmar_pedido sem confirmação explícita — pedido não finalizado.");
          } else if (agentResponse.intent === "confirmar_pedido") {
            try {
              const orderId = await OrdersService.finalizeOrder(session);
              session.state = BotState.FINISHED;
              session.activeOrderId = orderId;
              const { formatOrderNumber } = await import("@/lib/utils/format-order");
              finalBotText += `\n\n*(Pedido ${formatOrderNumber(orderId)} gerado com sucesso!)*`;
            } catch (e: unknown) {
              console.error("[Bot Process] Error finalizing order:", e);
              const errorMsg = e instanceof Error ? e.message : String(e);
              finalBotText = `Ops! Não consegui finalizar o seu pedido: ${errorMsg}\nPor favor, informe os dados que faltam para que eu possa concluir.`;
            }
          } else if (agentResponse.intent === "cancelar_pedido") {
            session.state = BotState.CANCELLED;
            const targetOrderId = session.activeOrderId || customer.activeOrderId;
            if (targetOrderId) {
              const existingOrder = await prisma.order.findUnique({
                where: { id: targetOrderId },
                select: { status: true }
              });
              if (existingOrder && ["PENDING", "CONFIRMED", "PREPARING"].includes(existingOrder.status)) {
                await prisma.order.update({
                  where: { id: targetOrderId },
                  data: { status: "CANCELLED" }
                });
                await prisma.customer.update({
                  where: { id: session.customerId },
                  data: { activeOrderId: null }
                });
                const { redisChannel, redisPub } = await import("@/lib/redis");
                await redisPub.publish(
                  redisChannel("tenant", session.tenantId, "order"),
                  JSON.stringify({ orderId: targetOrderId, status: "CANCELLED", event: "ORDER_STATUS_UPDATED" })
                );
              }
            }
            await SessionService.clearSession(session.tenantId, session.customerId);
          }

          // Injeção de Resumo: Se o pedido tem itens e forma de pagamento, e endereço (se delivery),
          // e ainda não foi finalizado nem cancelado, injetamos o resumo do carrinho para o cliente validar.
          const isReadyToConfirm =
            session.order.items.length > 0 &&
            session.payment &&
            (session.orderType !== 'DELIVERY' || session.customer.address) &&
            session.state !== BotState.START &&
            session.state !== BotState.SHOW_MENU &&
            session.state !== BotState.FINISHED &&
            session.state !== BotState.CANCELLED;
          if (isReadyToConfirm && agentResponse.intent !== "confirmar_pedido" && agentResponse.intent !== "cancelar_pedido") {
            const hasSummary = finalBotText.includes("Resumo") || finalBotText.includes("Total:");
            if (!hasSummary) {
              const deliveryFee = session.orderType === 'DELIVERY' ? (customer.tenant.deliveryFee || 0) : 0;
              const subtotal = session.order.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
              const total = subtotal + deliveryFee;

              let summary = `\n\n*📋 Resumo do seu pedido:*\n`;
              session.order.items.forEach(it => {
                const extras = it.additionalItems && it.additionalItems.length > 0
                  ? ` (Adic: ${it.additionalItems.map(a => a.name).join(", ")})`
                  : "";
                summary += `- ${it.quantity}x ${it.name}${extras}: R$ ${(it.price * it.quantity).toFixed(2)}\n`;
              });
              summary += `\n*Subtotal:* R$ ${subtotal.toFixed(2)}`;
              if (pendingWarnings.length > 0) {
                summary += `\n${pendingWarnings.map(w => `⚠️ ${w}`).join("\n")}`;
              }
              if (session.orderType === 'DELIVERY') {
                summary += `\n*Taxa de entrega:* R$ ${deliveryFee.toFixed(2)}`;
                summary += `\n*Endereço:* ${session.customer.address}`;
              } else if (session.orderType === 'PICKUP') {
                summary += `\n*Tipo:* Retirada no balcão`;
              }
              summary += `\n*Pagamento:* ${session.payment}`;
              summary += `\n*Total a pagar:* R$ ${total.toFixed(2)}\n`;
              summary += `\nPodemos confirmar o pedido? (Responda "sim" para finalizar ou peça para alterar algo).`;

              finalBotText += summary;
            }
          }

          // ── Guardrails de saída: rodam depois de tudo montado (LLM + resumo),
          // antes de enviar. Vetam o que custa dinheiro ou gera disputa.
          const extraPrices = (
            await prisma.additionalItem.findMany({
              where: { tenantId: customer.tenantId },
              select: { price: true },
            })
          ).map((e) => e.price);

          const priceCheck = checkPrices(
            finalBotText,
            allowedPriceCents(session, products, extraPrices, customer.tenant.deliveryFee || 0),
          );
          if (!priceCheck.ok) {
            await raiseAlert({
              tenantId: customer.tenantId,
              kind: "preco_incoerente",
              severity: "critical",
              title: "Resposta citou preço que não existe no catálogo",
              body: `Valores sem correspondência (centavos): ${priceCheck.offending.join(", ")}\n\nMensagem vetada:\n${finalBotText.slice(0, 1500)}`,
              refKind: "customer",
              refId: customer.id,
            });
            finalBotText = "Deixa eu confirmar os valores certinho com a equipe e já te respondo por aqui. 🙏";
          }

          const promiseCheck = stripDeliveryPromises(finalBotText);
          if (promiseCheck.removed) {
            await raiseAlert({
              tenantId: customer.tenantId,
              kind: "prazo_inventado",
              severity: "warn",
              title: "Resposta prometeu prazo de entrega",
              body: `Prazo removido da mensagem:\n${finalBotText.slice(0, 1500)}`,
              refKind: "customer",
              refId: customer.id,
            });
            finalBotText =
              promiseCheck.text.trim() || "Deixa eu confirmar o prazo com a cozinha e já te respondo por aqui.";
          }

          // B6: o contexto guardava um JSON truncado em 150 chars — o bot não
          // conseguia reler o que ele mesmo disse. Guarda a mensagem real.
          compressedContext = finalBotText;
        } // else: normal bot flow (skip order processing for ENCOMENDA)
      } // else: caminho LLM (encomenda por palavra-chave já tratada acima)
    }

    // 5. Append interaction to context
    const ctxLimit = Math.max(10, (botSetting.messageContextLimit ?? 10) * 2);
    await SessionService.appendContext(session, "user", fullMessage, ctxLimit);
    await SessionService.appendContext(session, "assistant", compressedContext, ctxLimit);

    // Release Lock
    await MessageBuffer.releaseLock(customer.tenantId, customerId);

    // 6. Send response (auto-splits long messages with typing delays)
    try {
      await (deps.send ?? sendChunkedResponse)({
        phone: customer.phone,
        customerId: customer.id,
        tenantId: customer.tenantId,
        customerName: customer.name || customer.phone,
        isHumanAttending: customer.isHumanAttending,
        text: finalBotText,
      });
    } catch (sendErr: unknown) {
      const sendErrMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.warn(`[Bot Process] Warning sending final bot text to ${customer.phone}:`, sendErrMsg);
    }

    await evolutionGo.sendPresence(customer.phone, "paused").catch(() => { });

    return NextResponse.json({ status: "success", response: finalBotText });
  } catch (error: unknown) {
    console.error("[Bot Process] Error:", error);

    // Libera o debounce mesmo no erro: com TTL de 120s, o lock preso deixaria o
    // cliente sem resposta por dois minutos.
    if (heldLock) {
      await MessageBuffer.releaseLock(heldLock.tenantId, heldLock.customerId).catch(() => {});
    }

    if (error instanceof LlmBudgetExceededError) {
      // O teto é uma válvula de segurança deliberada: o dono precisa agir, e o
      // alerta é a única forma de ele saber. Sem LLM não há resposta ao cliente.
      if (heldLock) {
        await raiseAlert({
          tenantId: heldLock.tenantId,
          kind: "orcamento_estourado",
          severity: "critical",
          title: "Teto mensal de gasto com IA atingido — bot parou de responder",
          body: error.message,
        });
      }
      return NextResponse.json({ error: "budget_exceeded" }, { status: 429 });
    }

    if (heldLock) {
      await raiseAlert({
        tenantId: heldLock.tenantId,
        kind: "bot_erro",
        severity: "warn",
        title: "Erro ao processar mensagem do bot",
        body: `${error instanceof Error ? (error.stack ?? error.message) : String(error)}`.slice(0, 4000),
        refKind: "customer",
        refId: heldLock.customerId,
      });
    }

    if (process.env.NODE_ENV !== "test") {
      try {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack || "no-stack" : "no-stack";
        const fs = await import("fs");
        const path = await import("path");
        fs.writeFileSync(
          path.join(process.cwd(), "bot-error.log"),
          `${new Date().toISOString()}\nError: ${errorMsg}\nStack: ${errorStack}\n`,
          { flag: "a" }
        );
      } catch (fsErr) {
        console.error("Failed to write bot error log:", fsErr);
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
