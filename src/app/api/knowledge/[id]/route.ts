import { NextResponse } from "next/server";
import { KnowledgeService } from "@/lib/services/knowledge.service";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

export const dynamic = "force-dynamic";

// PATCH /api/knowledge/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();

  const updated = await KnowledgeService.update(user.tenantId, id, {
    ...(body.question !== undefined && { question: String(body.question) }),
    ...(body.answer !== undefined && { answer: String(body.answer) }),
    ...(body.keywords !== undefined && { keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : [] }),
    ...(body.category !== undefined && { category: String(body.category) }),
    ...(body.priority !== undefined && { priority: Number(body.priority) }),
    ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
  });

  if (!updated) {
    return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ status: "updated" });
}

// DELETE /api/knowledge/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const removed = await KnowledgeService.remove(user.tenantId, id);

  if (!removed) {
    return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ status: "deleted" });
}
