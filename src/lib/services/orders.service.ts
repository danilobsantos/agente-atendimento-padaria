import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BotSession, OrderItemState } from "../types/session";
import { ProductsService } from "./products.service";
import { SessionService } from "./session.service";
import { redisPub } from "@/lib/redis";

export class OrdersService {
  static async updateOrderItems(session: BotSession, newItems: { id: string, quantity: number, notes?: string }[]): Promise<string> {
    if (newItems.length === 0) return "Nenhum item válido para adicionar.";

    // Release a stale active order (DISPATCHED/READY/DELIVERED/CANCELLED) so items
    // land in a fresh cart instead of mutating a finished order.
    await SessionService.releaseStaleActiveOrder(session);

    // products = the AUTHORITATIVE full cart (per prompt rule 1); REPLACE, not accumulate.
    const resolved: OrderItemState[] = [];
    const addedDescriptions: string[] = [];

    for (const newItem of newItems) {
      const product = await ProductsService.getProductById(session.tenantId, newItem.id);
      if (!product) continue;

      const qty = Math.max(1, newItem.quantity || 1);
      const existing = session.order.items.find(i => i.productId === product.id);
      // ponytail: keep notes the LLM didn't re-send so chosen add-ons (e.g. "GRANDE") aren't dropped
      const notes = newItem.notes ?? existing?.notes;

      resolved.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        notes,
      });
      addedDescriptions.push(`${qty}x ${product.name}`);
    }

    if (resolved.length === 0) return "Não foi possível encontrar os produtos solicitados.";

    session.order.items = resolved;
    this.recalculateTotal(session);
    await SessionService.saveSession(session);

    if (session.activeOrderId) {
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
      const activeOrder = await prisma.order.findUnique({
        where: { id: session.activeOrderId },
        select: { status: true },
      });
      await redisPub.publish(
        `tenant:${session.tenantId}:order`,
        JSON.stringify({ orderId: session.activeOrderId, status: activeOrder?.status, event: "ORDER_UPDATED" })
      );
    }

    return addedDescriptions.length > 0
      ? `Carrinho atual: ${addedDescriptions.join(", ")}. Total: R$ ${session.order.total.toFixed(2)}.`
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

    // Pickup orders don't need an address
    if (session.orderType !== "PICKUP" && !session.customer.address) {
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
          deliveryAddress: session.orderType === "PICKUP"
            ? Prisma.DbNull
            : { fullAddress: session.customer.address },
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
        deliveryAddress: session.orderType === "PICKUP"
          ? Prisma.DbNull
          : { fullAddress: session.customer.address },
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
