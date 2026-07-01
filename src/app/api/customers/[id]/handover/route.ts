import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/customers/[id]/handover — Toggle human handover
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { isHumanAttending } = body;

  if (typeof isHumanAttending !== "boolean") {
    return NextResponse.json(
      { error: "isHumanAttending (boolean) is required" },
      { status: 400 }
    );
  }

  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: { isHumanAttending },
    });

    // Publish event to Redis for WebSocket broadcast
    const { redisPub } = await import("@/lib/redis");
    await redisPub.publish(
      `tenant:${customer.tenantId}:customer`,
      JSON.stringify({
        customerId: customer.id,
        isHumanAttending: customer.isHumanAttending,
      })
    );

    return NextResponse.json({
      customerId: customer.id,
      isHumanAttending: customer.isHumanAttending,
    });
  } catch {
    return NextResponse.json(
      { error: "Customer not found" },
      { status: 404 }
    );
  }
}
