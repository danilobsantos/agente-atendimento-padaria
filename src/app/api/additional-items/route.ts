import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

// GET /api/additional-items
export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const items = await prisma.additionalItem.findMany({
    where: { tenantId: user.tenantId },
    include: { category: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(items);
}

// POST /api/additional-items — Create a new additional item
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { categoryId, name, description, price, isAvailable, sortOrder } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: "name and price are required" }, { status: 400 });
    }

    // Adicionais são lidos ao vivo por searchProducts (não passam pelo cache de 12h).
    const item = await prisma.additionalItem.create({
      data: {
        tenantId: user.tenantId,
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
