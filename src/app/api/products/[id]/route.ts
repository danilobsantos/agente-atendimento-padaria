import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";
import { ProductsService } from "@/lib/services/products.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/products/[id]
export async function GET(_request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { category: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
}

// PATCH /api/products/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  // findFirst com tenantId: um id de outro tenant não é editável.
  const existing = await prisma.product.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.price !== undefined && { price: parseFloat(body.price) }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  await ProductsService.clearCache(user.tenantId);

  return NextResponse.json(product);
}

// DELETE /api/products/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const { count } = await prisma.product.deleteMany({ where: { id, tenantId: user.tenantId } });

  if (count === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await ProductsService.clearCache(user.tenantId);

  return NextResponse.json({ status: "deleted" });
}
