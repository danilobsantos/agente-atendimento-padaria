import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/additional-items/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();

  try {
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
  } catch {
    return NextResponse.json({ error: "Additional item not found" }, { status: 404 });
  }
}

// DELETE /api/additional-items/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.additionalItem.delete({ where: { id } });
    return NextResponse.json({ status: "deleted" });
  } catch {
    return NextResponse.json({ error: "Additional item not found" }, { status: 404 });
  }
}
