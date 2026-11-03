import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

export const dynamic = "force-dynamic";

const VALID = new Set(["open", "ack", "resolved"]);

// PATCH /api/alerts/[id] — { status: "ack" | "resolved" | "open" }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const { status } = await request.json();

  if (!VALID.has(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const { count } = await prisma.alert.updateMany({
    where: { id, tenantId: user.tenantId },
    data: {
      status,
      resolvedAt: status === "resolved" ? new Date() : null,
    },
  });

  if (count === 0) {
    return NextResponse.json({ error: "Alerta não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ status });
}
