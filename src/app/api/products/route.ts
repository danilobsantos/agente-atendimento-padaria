import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";
import { ProductsService } from "@/lib/services/products.service";

// GET /api/products — List all products for the authenticated tenant
export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const products = await prisma.product.findMany({
    where: { tenantId: user.tenantId },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  return NextResponse.json(products);
}

// POST /api/products — Create a new product
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { categoryId, name, description, price, imageUrl, isAvailable } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: "name and price are required" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        tenantId: user.tenantId,
        categoryId,
        name,
        description,
        price: parseFloat(price),
        imageUrl,
        isAvailable: isAvailable ?? true,
      },
    });

    // Sem isso o cardápio do bot fica com preço velho por até 12h (cache).
    await ProductsService.clearCache(user.tenantId);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("[Products] Error creating product:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
