import { prisma } from "@/lib/prisma";
import { normalize, tokenHitRatio } from "@/lib/utils/fuzzy";

export interface KnowledgeHit {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  priority: number;
}

/**
 * Base de conhecimento do bot: regras do negócio + FAQ.
 *
 * Sem embeddings de propósito — ~20 entradas não justificam pgvector, e o
 * matcher fuzzy do cardápio já resolve erro de digitação e sinônimo simples.
 * O trade-off está anotado no PLANO-ROBUSTEZ.md.
 */
export class KnowledgeService {
  static async search(tenantId: string, query: string, limit = 3): Promise<KnowledgeHit[]> {
    const entries = await prisma.knowledgeEntry.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    });

    const scored = entries
      .map((entry) => {
        const target = `${entry.question} ${entry.keywords.join(" ")}`;
        const score = tokenHitRatio(query, target);
        return { entry, score };
      })
      // 50% dos tokens: "quanto custa a entrega?" casa com "qual a taxa de
      // entrega?" (entrega/custa), mas não com uma FAQ qualquer.
      .filter((s) => s.score >= 0.5)
      .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority);

    return scored.slice(0, limit).map(({ entry }) => ({
      id: entry.id,
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      priority: entry.priority,
    }));
  }

  static async list(tenantId: string) {
    return prisma.knowledgeEntry.findMany({
      where: { tenantId },
      orderBy: [{ priority: "desc" }, { question: "asc" }],
    });
  }

  static async create(
    tenantId: string,
    data: { question: string; answer: string; keywords?: string[]; category?: string; priority?: number },
  ) {
    return prisma.knowledgeEntry.create({
      data: {
        tenantId,
        question: data.question.trim(),
        answer: data.answer.trim(),
        keywords: (data.keywords ?? []).map((k) => normalize(k).trim()).filter(Boolean),
        category: data.category?.trim() || "Geral",
        priority: data.priority ?? 0,
      },
    });
  }

  static async update(
    tenantId: string,
    id: string,
    data: { question?: string; answer?: string; keywords?: string[]; category?: string; priority?: number; isActive?: boolean },
  ) {
    // `updateMany` com tenantId: sem isso um id de outro tenant seria editável.
    const { count } = await prisma.knowledgeEntry.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.question !== undefined ? { question: data.question.trim() } : {}),
        ...(data.answer !== undefined ? { answer: data.answer.trim() } : {}),
        ...(data.keywords !== undefined
          ? { keywords: data.keywords.map((k) => normalize(k).trim()).filter(Boolean) }
          : {}),
        ...(data.category !== undefined ? { category: data.category.trim() || "Geral" } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    return count > 0;
  }

  static async remove(tenantId: string, id: string): Promise<boolean> {
    const { count } = await prisma.knowledgeEntry.deleteMany({ where: { id, tenantId } });
    return count > 0;
  }
}
