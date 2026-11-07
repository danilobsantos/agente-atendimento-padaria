import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

// POST /api/customers/[id]/handover — Toggle human handover
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const { isHumanAttending } = body;

  if (typeof isHumanAttending !== "boolean") {
    return NextResponse.json({ error: "isHumanAttending (boolean) is required" }, { status: 400 });
  }

  const target = await prisma.customer.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: { isHumanAttending, botSilencedUntil: null },
  });

  const { redisChannel, redisPub } = await import("@/lib/redis");
  await redisPub.publish(
    redisChannel("tenant", customer.tenantId, "customer"),
    JSON.stringify({
      customerId: customer.id,
      isHumanAttending: customer.isHumanAttending,
    })
  );

  return NextResponse.json({
    customerId: customer.id,
    isHumanAttending: customer.isHumanAttending,
  });
}
