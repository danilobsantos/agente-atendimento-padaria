import { prisma } from "@/lib/prisma";
import { BotSession, OrderItemState } from "../types/session";
import { ProductsService } from "./products.service";
import { SessionService } from "./session.service";
import { redisPub } from "@/lib/redis";

export class OrdersService {
  static async updateOrderItems(session: BotSession, newItems: { id: string, quantity: number, notes?: string }[]): Promise<string> {
    if (newItems.length === 0) return "Nenhum item válido para adicionar.";

    let addedDescriptions: string[] = [];
    
    for (const newItem of newItems) {
      const product = await ProductsService.getProductById(session.tenantId, newItem.id);
      if (!product) continue;

      const qty = Math.max(1, newItem.quantity || 1);
      
      // Check if product is already in the order
      const existingItemIndex = session.order.items.findIndex(i => i.productId === product.id);
      if (existingItemIndex >= 0) {
        // Update existing item
        session.order.items[existingItemIndex].quantity += qty;
        if (newItem.notes) {
          session.order.items[existingItemIndex].notes = newItem.notes;
        }
      } else {
        // Add new item
        session.order.items.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: qty,
          notes: newItem.notes,
        });
      }
      addedDescriptions.push(`${qty}x ${product.name}`);
    }

    this.recalculateTotal(session);
    await SessionService.saveSession(session);

    if (session.activeOrderId && addedDescriptions.length > 0) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: session.activeOrderId },
        select: { status: true },
      });

      if (existingOrder && ["PENDING", "CONFIRMED", "PREPARING"].includes(existingOrder.status)) {
        await prisma.order.update({
          where: { id: session.activeOrderId },
          data: {
            total: session.order.total,
            items: {
              deleteMany: {},
              create: session.order.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                notes: item.notes,
              })),
            },
          },
        });

        // Notify Dashboard of the update
        await redisPub.publish(
          `tenant:${session.tenantId}:order`,
          JSON.stringify({ orderId: session.activeOrderId, status: existingOrder.status, event: "ORDER_UPDATED" })
        );
      } else {
        return "⚠️ Não é mais possível alterar este pedido pois ele já saiu para entrega ou foi finalizado. Por favor, inicie um novo pedido.";
      }
    }

    return addedDescriptions.length > 0 
      ? `Itens adicionados: ${addedDescriptions.join(", ")}. Total atual: R$ ${session.order.total.toFixed(2)}.`
      : "Não foi possível encontrar os produtos solicitados.";
  }

  static recalculateTotal(session: BotSession) {
    const itemsTotal = session.order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    // Add delivery fee logic here if needed (e.g. static or calculated)
    session.order.deliveryFee = 0; 
    session.order.total = itemsTotal + session.order.deliveryFee;
  }

  static async finalizeOrder(session: BotSession): Promise<string> {
    if (session.order.items.length === 0) {
      throw new Error("O carrinho está vazio.");
    }

    if (!session.customer.address) {
      throw new Error("Endereço é obrigatório.");
    }

    if (!session.payment) {
      throw new Error("Forma de pagamento é obrigatória.");
    }

    if (session.activeOrderId) {
      // Order is already active. Just update address/payment and return.
      await prisma.order.update({
        where: { id: session.activeOrderId },
        data: {
          deliveryAddress: {
            fullAddress: session.customer.address,
          },
          notes: session.payment,
        },
      });

      await redisPub.publish(
        `tenant:${session.tenantId}:order`,
        JSON.stringify({ orderId: session.activeOrderId, status: "CONFIRMED", event: "ORDER_UPDATED" })
      );

      return session.activeOrderId;
    }

    // Persist into PostgreSQL (new order)
    const order = await prisma.order.create({
      data: {
        tenantId: session.tenantId,
        customerId: session.customerId,
        source: "WHATSAPP",
        status: "CONFIRMED",
        total: session.order.total,
        deliveryAddress: {
          fullAddress: session.customer.address,
        },
        notes: session.payment, // Payment details
        items: {
          create: session.order.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
          }))
        }
      },
    });

    // Link order as active for the customer
    await prisma.customer.update({
      where: { id: session.customerId },
      data: { activeOrderId: order.id },
    });

    // Notify Dashboard
    await redisPub.publish(
      `tenant:${session.tenantId}:order`,
      JSON.stringify({ orderId: order.id, status: order.status, event: "ORDER_CREATED" })
    );

    return order.id;
  }
}
