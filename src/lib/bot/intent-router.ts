import { BotSession, BotState } from "../types/session";
import { SessionService } from "../services/session.service";
import { OrdersService } from "../services/orders.service";

export interface IntentRouterResponse {
  bypassed: boolean;
  reply?: string;
}

export class IntentRouter {
  static async route(message: string, session: BotSession): Promise<IntentRouterResponse> {
    const text = message.trim().toLowerCase();

    // 1. Handle cancellations
    if (text === "cancelar" || text === "cancelar pedido") {
      session.state = BotState.CANCELLED;
      await SessionService.clearSession(session.tenantId, session.customerId);
      return { bypassed: true, reply: "Seu pedido foi cancelado com sucesso. Quando quiser fazer um novo pedido, é só mandar um Oi!" };
    }

    // 2. State-based fixed routing
    switch (session.state) {
      case BotState.START:
        // Greetings
        if (text === "oi" || text === "ola" || text === "olá" || text === "bom dia" || text === "boa tarde" || text === "boa noite") {
          session.state = BotState.SHOW_MENU;
          await SessionService.saveSession(session);
          const menuUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          return {
            bypassed: true,
            reply: `Olá! Bem-vindo(a) à Sabor de Minas! 😊 O que você gostaria de pedir hoje? Se preferir, você pode pedir pelo nosso cardápio online: ${menuUrl}/cardapio`
          };
        }
        break;

      case BotState.WAITING_NAME:
        if (text.length > 2) {
          session.customer.name = message.trim();
          session.state = BotState.WAITING_ADDRESS;
          await SessionService.saveSession(session);
          return { bypassed: true, reply: `Muito prazer, ${session.customer.name}! Por favor, digite agora o endereço completo para entrega.` };
        }
        break;

      case BotState.WAITING_ADDRESS:
        if (text.length > 5) {
          session.customer.address = message.trim();
          session.state = BotState.WAITING_PAYMENT;
          await SessionService.saveSession(session);
          return { bypassed: true, reply: "Endereço anotado! Qual será a forma de pagamento? (Dinheiro, PIX ou Cartão)" };
        }
        break;

      case BotState.WAITING_PAYMENT:
        if (text.includes("pix") || text.includes("dinheiro") || text.includes("cartão") || text.includes("cartao")) {
          session.payment = message.trim();
          session.state = BotState.CONFIRM_ORDER;
          await SessionService.saveSession(session);

          const itemsText = session.order.items.map(i => `${i.quantity}x ${i.name}`).join("\n");
          return {
            bypassed: true,
            reply: `Quase lá! Confirme seu pedido:\n\nItens:\n${itemsText}\n\nTotal: R$ ${session.order.total.toFixed(2)}\nEndereço: ${session.customer.address}\nPagamento: ${session.payment}\n\nResponda "confirmar" para enviar o pedido.`
          };
        }
        break;

      case BotState.CONFIRM_ORDER:
        if (text.includes("confirmar") || text === "sim" || text === "ok") {
          try {
            const orderId = await OrdersService.finalizeOrder(session);
            session.state = BotState.START;
            session.activeOrderId = orderId;
            const { formatOrderNumber } = await import("../utils/format-order");
            return { bypassed: true, reply: `Pedido confirmado com sucesso! Já começamos a prepará-lo. (Pedido ${formatOrderNumber(orderId)})` };
          } catch (e: any) {
            console.error("[Intent Router] Error finalizing order:", e);
            return { bypassed: true, reply: `Erro ao finalizar: ${e.message}` };
          }
        }
        break;

      case BotState.FINISHED:
      case BotState.CANCELLED:
        // Restart flow
        session.state = BotState.START;
        session.order.items = [];
        session.order.total = 0;
        session.activeOrderId = undefined;
        await SessionService.saveSession(session);
        return { bypassed: true, reply: "Olá novamente! Em que posso ajudar hoje?" };
    }

    // 3. Guard Rails (Não-Bypass, apenas mutação de estado antes do LLM)
    let stateChanged = false;

    // Classificação de tipo de pedido precoce
    if (!session.orderType) {
      if (/\b(entrega|delivery)\b/i.test(text)) {
        session.orderType = "DELIVERY";
        stateChanged = true;
      } else if (/\b(retirada|buscar|balcão|balcao|aqui)\b/i.test(text)) {
        session.orderType = "PICKUP";
        stateChanged = true;
      }
    }

    // Classificação de pagamento precoce
    if (!session.payment) {
      const paymentMatch = text.match(/\b(pix|dinheiro|cartão|cartao)\b/i);
      if (paymentMatch) {
        session.payment = paymentMatch[0].toUpperCase() === "CARTAO" ? "CARTÃO" : paymentMatch[0].toUpperCase();
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await SessionService.saveSession(session);
    }

    // Bypass total se for apenas pedido de cardápio
    const isMenuRequest = /^(menu|cardapio|cardápio|o que tem|opções|opcoes|ver cardapio|qual o cardápio)$/i.test(text);
    if (isMenuRequest) {
      const menuUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
      return {
        bypassed: true,
        reply: `Aqui está o nosso cardápio completo: ${menuUrl}/cardapio 😊 Dá para escolher tudo por lá, ou me pedir por aqui mesmo!`
      };
    }

    // Return bypassed: false if we couldn't resolve the intent locally
    // This will trigger the LLM
    return { bypassed: false };
  }
}
