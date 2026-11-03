import { BotSession, BotState } from "../types/session";
import { SessionService } from "../services/session.service";

export interface IntentRouterResponse {
  bypassed: boolean;
  reply?: string;
}

export class IntentRouter {
  static async route(message: string, session: BotSession): Promise<IntentRouterResponse> {
    const text = message.trim().toLowerCase();

    // 1. Handle cancellations and new order requests
    if (text === "cancelar" || text === "cancelar pedido") {
      session.state = BotState.CANCELLED;
      await SessionService.clearSession(session.tenantId, session.customerId);
      return { bypassed: true, reply: "Seu pedido foi cancelado com sucesso. Quando quiser fazer um novo pedido, é só mandar um Oi!" };
    }

    if (/\b(novo pedido|outro pedido|fazer outro pedido|quero outro pedido|fazer um novo pedido|come[çc]ar de novo|limpar carrinho|zerar carrinho)\b/i.test(text)) {
      session.state = BotState.START;
      session.order.items = [];
      session.order.total = 0;
      session.order.deliveryFee = 0;
      session.payment = undefined;
      session.orderType = undefined;
      session.activeOrderId = undefined;
      const { prisma } = await import("@/lib/prisma");
      await prisma.customer.update({
        where: { id: session.customerId },
        data: { activeOrderId: null }
      }).catch(() => {});
      await SessionService.saveSession(session);
      const menuUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
      return {
        bypassed: true,
        reply: `Com certeza! Iniciei um novo pedido com o carrinho limpo. 😊 O que você gostaria de pedir hoje? Se preferir, veja nosso cardápio online: ${menuUrl}/cardapio`
      };
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

      case BotState.FINISHED:
      case BotState.CANCELLED:
        // Restart flow
        session.state = BotState.START;
        session.order.items = [];
        session.order.total = 0;
        session.order.deliveryFee = 0;
        session.activeOrderId = undefined;
        session.payment = undefined;
        session.orderType = undefined;
        await SessionService.saveSession(session);
        if (text === "oi" || text === "ola" || text === "olá" || text === "bom dia" || text === "boa tarde" || text === "boa noite") {
          const menuUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
          return {
            bypassed: true,
            reply: `Olá! Bem-vindo(a) novamente! 😊 O que você gostaria de pedir hoje? Se preferir, você pode pedir pelo nosso cardápio online: ${menuUrl}/cardapio`
          };
        }
        break;
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
