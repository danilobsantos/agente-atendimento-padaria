import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products — List all products for a tenant
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { tenantId },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  return NextResponse.json(products);
}

// POST /api/products — Create a new product
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, categoryId, name, description, price, imageUrl, isAvailable } = body;

    if (!tenantId || !name || price === undefined) {
      return NextResponse.json(
        { error: "tenantId, name, and price are required" },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        tenantId,
        categoryId,
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        isAvailable: isAvailable ?? true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("[Products] Error creating product:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
