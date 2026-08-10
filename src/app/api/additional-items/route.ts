import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/additional-items — List all additional items for a tenant
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const items = await prisma.additionalItem.findMany({
    where: { tenantId },
    include: { category: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(items);
}

// POST /api/additional-items — Create a new additional item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, categoryId, name, description, price, isAvailable, sortOrder } = body;

    if (!tenantId || !name || price === undefined) {
      return NextResponse.json(
        { error: "tenantId, name, and price are required" },
        { status: 400 }
      );
    }

    const item = await prisma.additionalItem.create({
      data: {
        tenantId,
        categoryId,
        name,
        description,
        price: parseFloat(price),
        isAvailable: isAvailable ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("[AdditionalItems] Error creating item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
