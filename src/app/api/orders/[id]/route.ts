import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

// PATCH /api/orders/[id] — Update order status
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();

  try {
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    // Clear activeOrderId on customer if status transitions to completed/cancelled/dispatched
    if (body.status === "DISPATCHED" || body.status === "DELIVERED" || body.status === "CANCELLED") {
      await prisma.customer.update({
        where: { id: order.customerId },
        data: { activeOrderId: null },
      });
    }

    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
