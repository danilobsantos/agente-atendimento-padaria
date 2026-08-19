import { prisma } from "@/lib/prisma";
import { redisKey, redisPub as redis } from "@/lib/redis";

export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  category: string;
  categoryId: string | null;
  description: string | null;
}

export interface SearchExtra {
  id: string;
  name: string;
  price: number;
}

export interface SearchProduct extends ProductSummary {
  shortId: string;
  extras: SearchExtra[];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

// ponytail: substring exata primeiro; fallback fuzzy p/ typos/grafias
// (ex.: "cappucino" vs "Capuccino"). Busca curta continua exata.
function matchesNome(nome: string, busca: string): boolean {
  if (nome.includes(busca)) return true;
  return busca.length >= 5 && levenshtein(nome, busca) <= 2;
}

export class ProductsService {
  private static getCacheKey(tenantId: string): string {
    return redisKey("cache", "products", tenantId);
  }

  static async getProducts(tenantId: string): Promise<ProductSummary[]> {
    const cacheKey = this.getCacheKey(tenantId);
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ProductSummary[];
    }

    // Fetch from DB
    const products = await prisma.product.findMany({
      where: { tenantId, isAvailable: true },
      include: { category: true },
    });

    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category?.name || "Geral",
      categoryId: p.categoryId,
      description: p.description,
    }));

    // Save to cache for 12 hours
    await redis.setex(cacheKey, 60 * 60 * 12, JSON.stringify(formatted));

    return formatted;
  }

  static async clearCache(tenantId: string): Promise<void> {
    const cacheKey = this.getCacheKey(tenantId);
    await redis.del(cacheKey);
  }

  static async getProductById(tenantId: string, productId: string): Promise<ProductSummary | null> {
    const products = await this.getProducts(tenantId);
    return products.find(p => p.id === productId) || null;
  }

  static async searchProducts(
    tenantId: string,
    opts: { busca?: string; categoria?: string },
    limit = 25
  ): Promise<SearchProduct[]> {
    const products = await this.getProducts(tenantId);

    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const busca = (opts.busca || "").trim().toLowerCase();
    const categoria = (opts.categoria || "").trim().toLowerCase();

    const filtered = products.filter((p) => {
      if (busca && !matchesNome(normalize(p.name), busca)) return false;
      if (categoria && !normalize(p.category).includes(normalize(categoria))) return false;
      return true;
    });

    const extras = await prisma.additionalItem.findMany({
      where: { tenantId, isAvailable: true },
    });
    const extrasByCategory = new Map<string | null, SearchExtra[]>();
    for (const e of extras) {
      const list = extrasByCategory.get(e.categoryId) || [];
      list.push({ id: e.id, name: e.name, price: e.price });
      extrasByCategory.set(e.categoryId, list);
    }
    const extrasFor = (categoryId: string | null): SearchExtra[] => [
      ...(extrasByCategory.get(null) || []),
      ...(categoryId ? extrasByCategory.get(categoryId) || [] : []),
    ];

    return filtered.slice(0, limit).map((p) => {
      const shortId = String(products.findIndex((x) => x.id === p.id) + 1);
      return {
        ...p,
        shortId,
        extras: extrasFor(p.categoryId),
      };
    });
  }
}
