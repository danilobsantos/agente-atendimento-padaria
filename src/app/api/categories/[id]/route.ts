import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";
import { ProductsService } from "@/lib/services/products.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/categories/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.category.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  // O cache do cardápio guarda o nome da categoria de cada produto.
  await ProductsService.clearCache(user.tenantId);

  return NextResponse.json(category);
}

// DELETE /api/categories/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const { count } = await prisma.category.deleteMany({ where: { id, tenantId: user.tenantId } });

  if (count === 0) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  await ProductsService.clearCache(user.tenantId);

  return NextResponse.json({ status: "deleted" });
}
