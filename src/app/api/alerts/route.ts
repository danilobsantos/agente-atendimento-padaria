import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

export const dynamic = "force-dynamic";

// GET /api/alerts?status=open
export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";

  const alerts = await prisma.alert.findMany({
    where: { tenantId: user.tenantId, ...(status !== "all" && { status }) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(alerts);
}
