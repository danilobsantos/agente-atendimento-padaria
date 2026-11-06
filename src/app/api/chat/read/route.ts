import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { customerId } = body;

    if (!customerId || typeof customerId !== "string") {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    await prisma.customer.updateMany({
      where: {
        id: customerId,
        tenantId: user.tenantId,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Chat Read] Error marking conversation as read:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

