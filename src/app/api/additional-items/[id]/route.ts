import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/additional-items/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.additionalItem.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Additional item not found" }, { status: 404 });
  }

  const item = await prisma.additionalItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.price !== undefined && { price: parseFloat(body.price) }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  return NextResponse.json(item);
}

// DELETE /api/additional-items/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const { count } = await prisma.additionalItem.deleteMany({ where: { id, tenantId: user.tenantId } });

  if (count === 0) {
    return NextResponse.json({ error: "Additional item not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "deleted" });
}
