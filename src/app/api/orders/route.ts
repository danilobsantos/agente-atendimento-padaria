import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/orders — List orders for a tenant (with filters)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const status = searchParams.get("status");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      ...(status && { status: status as never }),
    },
    include: {
      customer: true,
      items: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

// POST /api/orders — Create a new order
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, customerId, customerPhone, customerName, source, deliveryAddress, notes, items } = body;

    if (!tenantId || (!customerId && !customerPhone) || !source || !items?.length) {
      return NextResponse.json(
        { error: "tenantId, customerId (or customerPhone), source, and items are required" },
        { status: 400 }
      );
    }

    let finalCustomerId = customerId;
    if (!finalCustomerId && customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, "");
      const customer = await prisma.customer.upsert({
        where: {
          tenantId_phone: {
            tenantId,
            phone: cleanPhone,
          },
        },
        update: {
          ...(customerName && { name: customerName }),
        },
        create: {
          tenantId,
          phone: cleanPhone,
          name: customerName || null,
        },
      });
      finalCustomerId = customer.id;
    }

    // Fetch product prices to calculate total
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productPriceMap = new Map(products.map((p: { id: string; price: number }) => [p.id, p.price]));

    // Fetch additional item prices (authoritative for pricing)
    const extraIds = [
      ...new Set(
        (items as { additionalItems?: { id: string }[] }[])
          .flatMap((i) => i.additionalItems || [])
          .map((e) => e.id)
      ),
    ];
    const extraItems =
      extraIds.length > 0
        ? await prisma.additionalItem.findMany({ where: { id: { in: extraIds } } })
        : [];
    const extraMap = new Map(extraItems.map((e: { id: string; name: string; price: number }) => [e.id, e]));

    const orderItems = items.map((item: {
      productId: string;
      quantity: number;
      notes?: string;
      additionalItems?: { id: string; name: string; price: number }[];
    }) => {
      const additionalItems = (item.additionalItems || []).map((a) => {
        const db = extraMap.get(a.id);
        return {
          id: a.id,
          name: db?.name ?? a.name,
          price: db?.price ?? a.price,
        };
      });
      const basePrice = productPriceMap.get(item.productId) ?? 0;
      const extrasTotal = additionalItems.reduce((sum, a) => sum + a.price, 0);
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: basePrice + extrasTotal,
        notes: item.notes,
        additionalItems,
      };
    });

    const total = orderItems.reduce(
      (sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity,
      0
    );

    const order = await prisma.order.create({
      data: {
        tenantId,
        customerId: finalCustomerId,
        source,
        total,
        deliveryAddress: deliveryAddress ?? null,
        notes,
        status: source === "WEB" ? "CONFIRMED" : "PENDING",
        items: {
          create: orderItems,
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    // Set activeOrderId on customer so it becomes the editable active order
    await prisma.customer.update({
      where: { id: finalCustomerId },
      data: { activeOrderId: order.id },
    });

    // Publish order creation to Redis for real-time Kanban update
    const { redisPub } = await import("@/lib/redis");
    await redisPub.publish(
      `tenant:${tenantId}:order`,
      JSON.stringify({ orderId: order.id, status: order.status, event: "ORDER_CREATED" })
    );

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("[Orders] Error creating order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
