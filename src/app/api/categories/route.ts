import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";
import { ProductsService } from "@/lib/services/products.service";

// GET /api/categories
export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const categories = await prisma.category.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(categories);
}

// POST /api/categories — Create a new category
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { name, description, sortOrder, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        tenantId: user.tenantId,
        name,
        description,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    await ProductsService.clearCache(user.tenantId);

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("[Categories] Error creating category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
