import { prisma } from "@/lib/prisma";
import { redisPub as redis } from "@/lib/redis";

export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string | null;
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
}
