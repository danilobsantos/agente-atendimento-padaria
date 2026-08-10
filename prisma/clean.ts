import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import Redis from "ioredis";
import "dotenv/config";

async function clean() {
  console.log("🧹 Iniciando limpeza do banco de dados e Redis...");

  // 1. Limpeza do PostgreSQL via Prisma
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

  try {
    const deletedMessages = await prisma.chatMessage.deleteMany();
    console.log(`✅ Mensagens de chat excluídas: ${deletedMessages.count}`);

    const deletedOrderItems = await prisma.orderItem.deleteMany();
    console.log(`✅ Itens de pedidos excluídos: ${deletedOrderItems.count}`);

    const deletedOrders = await prisma.order.deleteMany();
    console.log(`✅ Pedidos excluídos: ${deletedOrders.count}`);

    const deletedCustomers = await prisma.customer.deleteMany();
    console.log(`✅ Clientes excluídos: ${deletedCustomers.count}`);

    await pool.end();
  } catch (dbError) {
    console.error("❌ Erro ao limpar PostgreSQL:", dbError);
  }

  // 2. Limpeza do Redis
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redis = new Redis(redisUrl);

  try {
    await redis.flushall();
    console.log("✅ Redis limpo (FLUSHALL concluído)");
    await redis.quit();
  } catch (redisError) {
    console.error("❌ Erro ao limpar Redis:", redisError);
  }

  console.log("✨ Limpeza concluída com sucesso! Os testes podem ser reiniciados do zero.");
}

clean().catch((e) => {
  console.error("❌ Falha geral na limpeza:", e);
  process.exit(1);
});
