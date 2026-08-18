import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/chat?customerId=xxx — Get chat history for a customer
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const tenantId = searchParams.get("tenantId");
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!customerId && !tenantId) {
    return NextResponse.json(
      { error: "customerId or tenantId is required" },
      { status: 400 }
    );
  }

  // If customerId is provided, return that customer's messages (latest 'limit' messages in ascending order)
  if (customerId) {
    const messages = await prisma.chatMessage.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json(messages.reverse());
  }

  // If only tenantId, return recent conversations (grouped by customer)
  const customers = await prisma.customer.findMany({
    where: { tenantId: tenantId! },
    include: {
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Filter to only customers who have messages and sort by last message date descending
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
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      return timeB - timeA;
    });

  return NextResponse.json(conversations);
}

// POST /api/chat — Send a message (from human operator)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, content } = body;

    if (!customerId || !content) {
      return NextResponse.json(
        { error: "customerId and content are required" },
        { status: 400 }
      );
    }

    // Save the human operator's message
    const message = await prisma.chatMessage.create({
      data: {
        customerId,
        sender: "HUMAN",
        content,
      },
    });

    // Automatically take over customer support (isHumanAttending: true) and get updated info
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { isHumanAttending: true },
    });

    if (customer) {
      // Publish event to Redis for WebSocket broadcast (message)
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

      // Publish event to Redis for WebSocket broadcast (customer status)
      await redisPub.publish(
        redisChannel("tenant", customer.tenantId, "customer"),
        JSON.stringify({
          customerId: customer.id,
          isHumanAttending: customer.isHumanAttending,
        })
      );

      // Send message via Evolution Go
      const { evolutionGo } = await import("@/lib/services/evolution-go");
      await evolutionGo.sendText({
        number: customer.phone,
        text: content,
      });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("[Chat] Error sending message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
