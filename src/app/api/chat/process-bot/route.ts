import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLLMService } from "@/lib/adapters/factory";
import { evolutionGo } from "@/lib/services/evolution-go";
import type { LLMMessage } from "@/lib/types/llm";

function cleanAndParseJSON(text: string) {
  let cleaned = text.trim();
  
  // Remove markdown JSON code block formatting if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?\n?/, "");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/```$/, "");
  }
  
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

function extractTextFromJSON(content: string): string {
  try {
    const parsed = cleanAndParseJSON(content);
    return parsed.text || content;
  } catch {
    // Regex fallback if JSON is truncated, matching even without a closing quote
    const match = content.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (match && match[1]) {
      return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    
    // Ultimate fallback: strip common JSON tail artifacts if present
    let fallback = content;
    const actionIndex = fallback.indexOf('","action"');
    if (actionIndex !== -1) {
      fallback = fallback.substring(0, actionIndex);
    }
    // Remove leading {"text":" if present
    fallback = fallback.replace(/^\{\s*"text"\s*:\s*"/, "");
    return fallback;
  }
}

function buildValidBotMessageJSON(content: string): string {
  const text = extractTextFromJSON(content);
  return JSON.stringify({
    text: text,
    action: {
      type: "NONE",
      items: [],
      deliveryAddress: { street: "", number: "", neighborhood: "" },
      notes: ""
    }
  });
}

export async function POST(request: Request) {
  try {
    const { customerId } = await request.json();

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    // 1. Fetch customer and bot settings
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        tenant: {
          include: {
            botSetting: true,
            products: {
              where: { isAvailable: true },
              include: { category: true },
            },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const botSetting = customer.tenant.botSetting;
    if (!botSetting || !botSetting.isActive || customer.isHumanAttending) {
      return NextResponse.json({ status: "skipped", reason: "bot_inactive_or_human_handover" });
    }

    if (!botSetting.llmApiKey) {
      return NextResponse.json({ error: "LLM API Key is not configured" }, { status: 400 });
    }

    // 2. Fetch active order (cart) if exists
    let activeOrder = null;
    if (customer.activeOrderId) {
      activeOrder = await prisma.order.findUnique({
        where: { id: customer.activeOrderId },
        include: { items: { include: { product: true } } },
      });
    }

    // 3. Fetch recent message history based on config
    const contextLimit = botSetting?.messageContextLimit ?? 15;
    const sessionTimeoutMs = (botSetting?.sessionTimeout ?? 1800) * 1000;
    const sessionCutoff = new Date(Date.now() - sessionTimeoutMs);

    const recentMessages = await prisma.chatMessage.findMany({
      where: { 
        customerId,
        createdAt: { gte: sessionCutoff }
      },
      orderBy: { createdAt: "desc" },
      take: contextLimit,
    });
    recentMessages.reverse();

    // 4. Build Menu context
    const menuContext = customer.tenant.products
      .map((p) => {
        const catName = p.category?.name || "Geral";
        return `- [${catName}] ${p.name} | R$ ${p.price.toFixed(2)} | (ID: ${p.id}) | ${p.description || "Sem descrição"}`;
      })
      .join("\n");

    // 5. Build Cart status context
    let cartContext = "Carrinho atual está VAZIO.";
    if (activeOrder && activeOrder.items.length > 0) {
      const itemsList = activeOrder.items
        .map((i) => `- ${i.product.name} (Qtd: ${i.quantity}) - R$ ${(i.price * i.quantity).toFixed(2)} (ID: ${i.product.id}) ${i.notes ? `[Obs: ${i.notes}]` : ""}`)
        .join("\n");
      cartContext = `
Carrinho Atual (ID Pedido: ${activeOrder.id}):
${itemsList}
Total Parcial: R$ ${activeOrder.total.toFixed(2)}
`;
    }

    // 6. System Instruction prompting strict JSON output
    const systemInstruction = `
${botSetting.systemPrompt}

CARDÁPIO DISPONÍVEL DA PADARIA:
${menuContext}

${cartContext}

Você deve conversar normalmente com o cliente, respondendo em português.
IMPORTANTE: Sempre que o cliente pedir para adicionar mais um item no pedido (ou alterar/remover itens), você deve OBRIGATORIAMENTE:
1. Adicionar o item ao pedido usando a ação "ADD_ITEMS". O array "items" deve conter a lista COMPLETA de todos os itens do carrinho atualizados (itens anteriores + novo item).
2. Confirmar o pedido completo com o cliente no campo "text" (ex: listando todos os itens atuais, suas quantidades e o total do pedido).
3. Atualizar o pedido no sistema através da execução dessa ação JSON.

No entanto, sua resposta deve ser OBRIGATORIAMENTE um objeto JSON válido seguindo a estrutura abaixo:
{
  "text": "Mensagem simpática que você vai enviar para o cliente respondendo à conversa ou resumindo o carrinho.",
  "action": {
    "type": "ADD_ITEMS" | "FINALIZE" | "NONE",
    "items": [
      {
        "productId": "O ID (UUID real) do produto exatamente como listado no CARDÁPIO DISPONÍVEL (ex: 'e2c20d9b-...'). NUNCA invente ou use IDs fictícios como 'prod-1' ou nomes de itens.",
        "quantity": 1,
        "notes": "Qualquer observação (ex: bem passado, sem cebola)"
      }
    ],
    "deliveryAddress": {
      "street": "Nome da rua/avenida de entrega (string)",
      "number": "Número da residência (string)",
      "neighborhood": "Bairro de entrega (string)"
    },
    "notes": "Informações de pagamento como Dinheiro, Cartão, PIX, etc."
  }
}

REGRAS DE AÇÃO:
1. Se o cliente solicitar produtos ou quiser adicionar mais itens a um pedido existente, use a action type "ADD_ITEMS" fornecendo os UUIDs reais dos produtos corretos e as quantidades. O array "items" deve representar a lista COMPLETA de itens do carrinho final (anterior + novos).
2. IMPORTANTE: Use SEMPRE o ID real (UUID completo) do produto que está listado no CARDÁPIO DISPONÍVEL. NUNCA invente ou use IDs fictícios como 'prod-1', 'pao-1' ou nomes de produtos no campo 'productId'.
3. Se o cliente remover produtos ou quiser limpar o carrinho, trate isso na conversa e você pode atualizar o carrinho adicionando ou ajustando.
4. Se o cliente fornecer o endereço e forma de pagamento, e desejar fechar/finalizar o pedido, use a action type "FINALIZE", preencha o objeto "deliveryAddress" com os campos "street", "number" e "neighborhood" e a forma de pagamento no campo "notes".
5. Se for apenas conversa normal (saudação, dúvidas), use action type "NONE" e deixe os outros campos de action vazios ou vazios [].
`;

    const llmMessages: LLMMessage[] = [
      { role: "system", content: systemInstruction },
      ...recentMessages.map((msg) => ({
        role: (msg.sender === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: msg.sender === "USER" ? msg.content : buildValidBotMessageJSON(msg.content),
      })),
    ];

    // Trigger WhatsApp typing status
    await evolutionGo.sendPresence(customer.phone, "composing").catch(() => {});

    // 7. Request LLM completion
    const llmService = createLLMService(botSetting.llmProvider);
    const llmResponse = await llmService.generate(llmMessages, {
      apiKey: botSetting.llmApiKey,
      model: botSetting.llmModel,
    });

    // 8. Parse the JSON response
    let textToSend = "";
    try {
      const parsed = cleanAndParseJSON(llmResponse.text);
      textToSend = parsed.text || "";

      const action = parsed.action;
      if (action && action.type !== "NONE") {
        if (action.type === "ADD_ITEMS" && action.items?.length > 0) {
          // Initialize order if not exists
          let orderId = customer.activeOrderId;
          if (!orderId) {
            const newOrder = await prisma.order.create({
              data: {
                tenantId: customer.tenantId,
                customerId: customer.id,
                source: "WHATSAPP",
                status: "PENDING",
              },
            });
            orderId = newOrder.id;
            await prisma.customer.update({
              where: { id: customer.id },
              data: { activeOrderId: orderId },
            });
          }

          // Clear existing order items to replace/update cart
          await prisma.orderItem.deleteMany({ where: { orderId: orderId! } });

          // Add new items
          let total = 0;
          for (const item of action.items) {
            const product = customer.tenant.products.find((p) => p.id === item.productId);
            if (product) {
              const qty = Math.max(1, parseInt(item.quantity) || 1);
              await prisma.orderItem.create({
                data: {
                  orderId: orderId!,
                  productId: product.id,
                  quantity: qty,
                  price: product.price,
                  notes: item.notes || null,
                },
              });
              total += product.price * qty;
            }
          }

          // Update order total
          const updatedOrder = await prisma.order.update({
            where: { id: orderId! },
            data: { total },
          });

          // Publish order update to Redis (for Kanban board update)
          const { redisPub } = await import("@/lib/redis");
          await redisPub.publish(
            `tenant:${customer.tenantId}:order`,
            JSON.stringify({ orderId, status: updatedOrder.status, event: "CART_UPDATED" })
          );
        } else if (action.type === "FINALIZE" && customer.activeOrderId) {
          // Fetch the current order status
          const existingOrder = await prisma.order.findUnique({
            where: { id: customer.activeOrderId },
            select: { status: true },
          });

          // Complete the order (only set status to CONFIRMED if it was PENDING)
          const updatedOrder = await prisma.order.update({
            where: { id: customer.activeOrderId },
            data: {
              ...(existingOrder?.status === "PENDING" && { status: "CONFIRMED" }),
              deliveryAddress: action.deliveryAddress || {},
              notes: action.notes || null,
            },
          });

          const completedOrderId = customer.activeOrderId;

          // Note: We keep activeOrderId set so that customers can still edit the order
          // until it gets Dispatched, Delivered, or Cancelled by the merchant.

          // Publish order creation to Redis (for Kanban board update)
          const { redisPub } = await import("@/lib/redis");
          await redisPub.publish(
            `tenant:${customer.tenantId}:order`,
            JSON.stringify({ orderId: completedOrderId, status: updatedOrder.status, event: "ORDER_CREATED" })
          );
        }
      }
    } catch (parseErr) {
      console.warn("[Bot Process] Failed to parse LLM response as JSON. Falling back to clean text extraction.", parseErr);
      textToSend = extractTextFromJSON(llmResponse.text); // Extract the dialogue text fallback
    }

    if (textToSend) {
      // Save bot response in database
      const botMessage = await prisma.chatMessage.create({
        data: {
          customerId: customer.id,
          sender: "BOT",
          content: textToSend,
        },
      });

      // Notify WebSocket server
      const { redisPub } = await import("@/lib/redis");
      await redisPub.publish(
        `tenant:${customer.tenantId}:message`,
        JSON.stringify({
          ...botMessage,
          customerName: customer.name || customer.phone,
          phone: customer.phone,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      // Send via WhatsApp
      await evolutionGo.sendText({
        number: customer.phone,
        text: textToSend,
      });
    }

    await evolutionGo.sendPresence(customer.phone, "paused").catch(() => {});

    return NextResponse.json({ status: "success", response: textToSend });
  } catch (error: any) {
    console.error("[Bot Process] Error:", error);
    try {
      const fs = require("fs");
      const path = require("path");
      fs.writeFileSync(
        path.join(process.cwd(), "bot-error.log"),
        `${new Date().toISOString()}\nError: ${error?.message || error}\nStack: ${error?.stack || "no-stack"}\n`
      );
    } catch (fsErr) {
      console.error("Failed to write bot error log:", fsErr);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
