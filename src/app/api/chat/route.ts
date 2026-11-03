import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

// GET /api/chat?customerId=xxx — Get chat history for a customer
export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const limit = parseInt(searchParams.get("limit") || "50");

  // Com customerId, valida que o cliente é do tenant do JWT antes de ler.
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json(messages.reverse());
  }

  // Sem customerId: conversas recentes do PRÓPRIO tenant.
  const customers = await prisma.customer.findMany({
    where: { tenantId: user.tenantId },
    include: {
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const conversations = customers
    .filter((c) => c.chatMessages.length > 0)
    .map((c) => ({
      customerId: c.id,
      customerName: c.name || c.phone,
      phone: c.phone,
      isHumanAttending: c.isHumanAttending,
      lastMessage: c.chatMessages[0],
    }))
    .sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

  return NextResponse.json(conversations);
}

// POST /api/chat — Send a message (from human operator)
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { customerId, content } = body;

    if (!customerId || !content) {
      return NextResponse.json({ error: "customerId and content are required" }, { status: 400 });
    }

    const target = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        customerId,
        sender: "HUMAN",
        content,
      },
    });

    // Human replied from the panel: take over the conversation.
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { isHumanAttending: true },
    });

    {
      const { redisChannel, redisPub } = await import("@/lib/redis");
      await redisPub.publish(
        redisChannel("tenant", customer.tenantId, "message"),
        JSON.stringify({
          ...message,
          customerName: customer.name || customer.phone,
          phone: customer.phone,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      await redisPub.publish(
        redisChannel("tenant", customer.tenantId, "customer"),
        JSON.stringify({
          customerId: customer.id,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      const { getEvolutionServiceForTenant } = await import("@/lib/services/evolution-go");
      const evolutionService = await getEvolutionServiceForTenant(customer.tenantId);
      try {
        await evolutionService.sendText({
          number: customer.phone,
          text: content,
        });
      } catch (sendErr: unknown) {
        const errorMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.warn(`[Chat] Failed to send WhatsApp message to ${customer.phone}:`, errorMsg);
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("[Chat] Error sending message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
