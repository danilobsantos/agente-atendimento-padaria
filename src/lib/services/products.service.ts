import { prisma } from "@/lib/prisma";
import { redisPub as redis } from "@/lib/redis";

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

export class ProductsService {
  private static getCacheKey(tenantId: string): string {
    return `cache:products:${tenantId}`;
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
      if (busca && !normalize(p.name).includes(normalize(busca))) return false;
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
