import { NextResponse } from "next/server";
import { KnowledgeService } from "@/lib/services/knowledge.service";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";

export const dynamic = "force-dynamic";

// GET /api/knowledge — entradas do tenant autenticado
export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  return NextResponse.json(await KnowledgeService.list(user.tenantId));
}

// POST /api/knowledge — cria uma entrada
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { question, answer, keywords, category, priority } = body;

  if (typeof question !== "string" || question.trim() === "" || typeof answer !== "string" || answer.trim() === "") {
    return NextResponse.json({ error: "question e answer são obrigatórios" }, { status: 400 });
  }

  const entry = await KnowledgeService.create(user.tenantId, {
    question,
    answer,
    keywords: Array.isArray(keywords) ? keywords : [],
    ...(category !== undefined ? { category } : {}),
    ...(priority !== undefined ? { priority: Number(priority) } : {}),
  });

  return NextResponse.json(entry, { status: 201 });
}
