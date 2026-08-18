import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BotSession, OrderItemState, OrderItemAdditionalState } from "../types/session";
import { ProductsService } from "./products.service";
import { SessionService } from "./session.service";
import { redisChannel, redisPub } from "@/lib/redis";

type IncomingAdditional = { id?: string; name?: string; price?: number };

export class OrdersService {
  // Resolve complementos against the catalog (authoritative id/price), matching the
  // web flow. Falls back to name so a UUID mangled by the LLM can still match.
  private static async resolveAdditionalItems(
    tenantId: string,
    incoming: IncomingAdditional[]
  ): Promise<OrderItemAdditionalState[]> {
    const locals = incoming.filter(a => a && (a.id || a.name));
    if (locals.length === 0) return [];

    const all = await prisma.additionalItem.findMany({ where: { tenantId, isAvailable: true } });
    const byId = new Map(all.map(e => [e.id, e]));
    const byName = new Map(all.map(e => [e.name.trim().toLowerCase(), e]));

    return locals.flatMap((a) => {
      const db = a.id
        ? byId.get(a.id)
        : undefined;
      const match = db ?? (a.name ? byName.get(a.name.trim().toLowerCase()) : undefined);
      if (!match) return [];
      return [{
        id: match.id,
        name: match.name,
        price: match.price,
      }];
    });
  }

  static async updateOrderItems(
    session: BotSession,
    newItems: { id: string, quantity: number, notes?: string, additionalItems?: IncomingAdditional[] }[]
  ): Promise<string> {
    if (newItems.length === 0) return "Nenhum item válido para adicionar.";

    // Release a stale active order (DISPATCHED/READY/DELIVERED/CANCELLED) so items
    // land in a fresh cart instead of mutating a finished order.
    await SessionService.releaseStaleActiveOrder(session);

    // Resolve complements once for the whole batch
    const extraByItem = await Promise.all(
      newItems.map(i => OrdersService.resolveAdditionalItems(session.tenantId, i.additionalItems || []))
    );

    // products = the AUTHORITATIVE full cart (per prompt rule 1); REPLACE, not accumulate.
    const resolved: OrderItemState[] = [];
    const addedDescriptions: string[] = [];

    for (let i = 0; i < newItems.length; i++) {
      const newItem = newItems[i];
      const product = await ProductsService.getProductById(session.tenantId, newItem.id);
      if (!product) continue;

      const qty = Math.max(1, newItem.quantity || 1);
      const existing = session.order.items.find(i => i.productId === product.id);
      // ponytail: keep notes/extras the LLM didn't re-send so chosen options aren't dropped
      const notes = newItem.notes ?? existing?.notes;
      const additionalItems = extraByItem[i].length > 0 ? extraByItem[i] : existing?.additionalItems;
      const extrasTotal = (additionalItems ?? []).reduce((sum, a) => sum + a.price, 0);

      resolved.push({
        productId: product.id,
        name: product.name,
        price: product.price + extrasTotal,
        quantity: qty,
        notes,
        ...(additionalItems !== undefined && { additionalItems }),
      });
      addedDescriptions.push(`${qty}x ${product.name}`);
    }

    if (resolved.length === 0) return "Não foi possível encontrar os produtos solicitados.";

    session.order.items = resolved;
    await this.recalculateTotal(session);
    await SessionService.saveSession(session);

    if (session.activeOrderId) {
      await prisma.order.update({
        where: { id: session.activeOrderId },
        data: {
          total: session.order.total,
          deliveryFee: session.order.deliveryFee,
          items: {
            deleteMany: {},
            create: session.order.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes,
              ...(item.additionalItems !== undefined && { additionalItems: item.additionalItems as unknown as Prisma.InputJsonValue }),
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
        redisChannel("tenant", session.tenantId, "order"),
        JSON.stringify({ orderId: session.activeOrderId, status: activeOrder?.status, event: "ORDER_UPDATED" })
      );
    }

    return addedDescriptions.length > 0
      ? `Carrinho atual: ${addedDescriptions.join(", ")}. Total: R$ ${session.order.total.toFixed(2)}.`
      : "Não foi possível encontrar os produtos solicitados.";
  }

  static async recalculateTotal(session: BotSession) {
    const itemsTotal = session.order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const fee = session.orderType === "PICKUP"
      ? 0
      : (await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { deliveryFee: true } }))?.deliveryFee ?? 0;
    session.order.deliveryFee = fee;
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
          total: session.order.total,
          deliveryFee: session.order.deliveryFee,
          notes: session.payment,
        },
      });

      await redisPub.publish(
        redisChannel("tenant", session.tenantId, "order"),
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
        deliveryFee: session.order.deliveryFee,
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
            ...(item.additionalItems !== undefined && { additionalItems: item.additionalItems as unknown as Prisma.InputJsonValue }),
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
      redisChannel("tenant", session.tenantId, "order"),
      JSON.stringify({ orderId: order.id, status: order.status, event: "ORDER_CREATED" })
    );

    return order.id;
  }
}
