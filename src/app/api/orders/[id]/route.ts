import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendChunkedResponse } from "@/lib/bot/message-sender";
import { formatOrderNumber } from "@/lib/utils/format-order";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/orders/[id]
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

// PATCH /api/orders/[id] — Update order status or items
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();

  try {
    // Fetch current status to check transition constraints
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Constraints:
    // 1. If status is DISPATCHED, only allow updating status to DELIVERED.
    if (existingOrder.status === "DISPATCHED" && body.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Pedidos com status 'Saiu pra entrega' não podem ser alterados ou cancelados." },
        { status: 400 }
      );
    }

    // 2. If status is DELIVERED or CANCELLED, no alterations allowed.
    if (existingOrder.status === "DELIVERED" || existingOrder.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Pedidos finalizados ou cancelados não podem ser alterados." },
        { status: 400 }
      );
    }

    let totalUpdate = {};
    let itemsUpdate = {};

    if (body.items !== undefined) {
      if (!Array.isArray(body.items)) {
        return NextResponse.json({ error: "O campo 'items' deve ser um array." }, { status: 400 });
      }

      if (body.items.length === 0) {
        return NextResponse.json({ error: "Um pedido deve ter pelo menos um item." }, { status: 400 });
      }

      // Fetch product prices to calculate total
      const productIds = body.items.map((i: { productId: string }) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      const productPriceMap = new Map(products.map((p: { id: string; price: number }) => [p.id, p.price]));

      const newOrderItems = body.items.map((item: { productId: string; quantity: number; notes?: string }) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: productPriceMap.get(item.productId) ?? 0,
        notes: item.notes || null,
      }));

      const total = newOrderItems.reduce(
        (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
        0
      );

      totalUpdate = { total };
      itemsUpdate = {
        deleteMany: {},
        create: newOrderItems,
      };
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...totalUpdate,
        ...(body.items !== undefined && { items: itemsUpdate }),
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    // Clear activeOrderId on customer if status transitions to completed/cancelled/dispatched
    if (body.status === "DISPATCHED" || body.status === "DELIVERED" || body.status === "CANCELLED" || body.status === "READY") {
      await prisma.customer.update({
        where: { id: order.customerId },
        data: { activeOrderId: null },
      });
    }

    // Publish order update to Redis (for Kanban board update)
    const { redisChannel, redisPub } = await import("@/lib/redis");
    await redisPub.publish(
      redisChannel("tenant", order.tenantId, "order"),
      JSON.stringify({ orderId: order.id, status: order.status, event: "ORDER_STATUS_UPDATED" })
    );

    // Notify the customer in background so the kanban card moves instantly (no LLM involved)
    if (body.status === "DISPATCHED") {
      const isPickup = !order.deliveryAddress;
      const dispatchText = isPickup
        ? `Seu pedido ${formatOrderNumber(order.id)} está pronto para retirada! Pode vir buscar.`
        : `Seu pedido ${formatOrderNumber(order.id)} saiu para entrega.`;
      void sendChunkedResponse({
        phone: order.customer.phone,
        customerId: order.customerId,
        tenantId: order.tenantId,
        customerName: order.customer.name ?? "",
        isHumanAttending: order.customer.isHumanAttending,
        text: dispatchText,
      }).catch(e => {
        console.error("Failed to notify customer about order dispatch:", e);
      });
    }

    return NextResponse.json(order);
  } catch (err: any) {
    console.error("Error in PATCH /api/orders/[id]:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
