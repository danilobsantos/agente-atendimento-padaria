import { redisKey, redisPub as redis } from "@/lib/redis";
import { BotSession, BotState } from "../types/session";
import { prisma } from "@/lib/prisma";
import { isOrderMutable } from "../utils/order-status";

const DEFAULT_SESSION_TTL = 1800; // 30 minutes fallback

export class SessionService {
  private static sessionTTL = DEFAULT_SESSION_TTL;

  static setTTL(seconds: number) {
    this.sessionTTL = seconds;
  }

  private static getKey(tenantId: string, customerId: string): string {
    return redisKey("session", tenantId, customerId);
  }

  static async getSession(tenantId: string, customerId: string, phone: string, activeOrderId?: string): Promise<BotSession> {
    const key = this.getKey(tenantId, customerId);
    const data = await redis.get(key);
    
    if (data) {
      const session = JSON.parse(data) as BotSession;
      // Ensure activeOrderId sync if passed
      if (activeOrderId && session.activeOrderId !== activeOrderId) {
        session.activeOrderId = activeOrderId;
        await this.saveSession(session);
      }
      // Release a stale active order (DISPATCHED/READY/DELIVERED/CANCELLED) so the
      // customer can start a new order instead of being permanently blocked.
      if (session.activeOrderId) {
        await this.releaseStaleActiveOrder(session);
      }
      return session;
    }

    // Default new session
    const newSession: BotSession = {
      tenantId,
      customerId,
      phone,
      state: BotState.START,
      customer: {},
      order: {
        items: [],
        total: 0,
        deliveryFee: 0,
      },
      context: [],
      activeOrderId: activeOrderId || undefined,
    };

    // Hydrate from PostgreSQL if activeOrderId exists
    if (newSession.activeOrderId) {
      const order = await prisma.order.findUnique({
        where: { id: newSession.activeOrderId },
        include: { items: { include: { product: true } } }
      });

      if (order && isOrderMutable(order.status)) {
        newSession.order.total = order.total;
        newSession.order.items = order.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
          name: i.product.name,
          notes: i.notes || undefined
        }));
        
        if (order.deliveryAddress) {
          const addr = order.deliveryAddress as any;
          newSession.customer.address = addr.fullAddress || "";
        } else {
          // Order without address = pickup (retirada)
          newSession.orderType = "PICKUP";
        }
        if (order.notes) {
          newSession.payment = order.notes;
        }
      } else {
        // Order is no longer active (e.g. dispatched/delivered)
        newSession.activeOrderId = undefined;
      }
    }

    await this.saveSession(newSession);
    return newSession;
  }

  static async saveSession(session: BotSession): Promise<void> {
    const key = this.getKey(session.tenantId, session.customerId);
    await redis.setex(key, this.sessionTTL, JSON.stringify(session));
  }

  static async releaseStaleActiveOrder(session: BotSession): Promise<void> {
    if (!session.activeOrderId) return;
    const order = await prisma.order.findUnique({
      where: { id: session.activeOrderId },
      select: { status: true },
    });
    if (!order || !isOrderMutable(order.status)) {
      session.activeOrderId = undefined;
      session.order = { items: [], total: 0, deliveryFee: 0 };
      await this.saveSession(session);
    }
  }

  static async clearSession(tenantId: string, customerId: string): Promise<void> {
    const key = this.getKey(tenantId, customerId);
    await redis.del(key);
  }

  static async appendContext(session: BotSession, role: "user" | "assistant", content: string, limit = 20): Promise<void> {
    session.context.push({ role, content });
    if (session.context.length > limit) {
      session.context = session.context.slice(-limit);
    }
    await this.saveSession(session);
  }
}
