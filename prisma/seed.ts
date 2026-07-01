import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import bcrypt from "bcryptjs";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

  console.log("🌱 Seeding database...");

  // Create the default tenant (padaria)
  const tenant = await prisma.tenant.upsert({
    where: { slug: "padaria-do-ze" },
    update: {},
    create: {
      name: "Padaria do Zé",
      slug: "padaria-do-ze",
      active: true,
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // Create default admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@padaria.com" },
    update: {},
    create: {
      email: "admin@padaria.com",
      name: "Zé da Padaria",
      passwordHash,
      tenantId: tenant.id,
    },
  });
  console.log(`✅ Default User: ${adminUser.email} (Senha: admin123)`);

  // Create bot settings
  await prisma.botSetting.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      llmProvider: "DEEPSEEK",
      llmApiKey: "",
      llmModel: "deepseek-chat",
      systemPrompt: `Você é o atendente virtual da Padaria do Zé. Seja educado, simpático e objetivo.
Ajude os clientes a fazer pedidos do nosso cardápio.
Quando o cliente pedir para adicionar mais um item no pedido, adicione o item, confirme o pedido completo com ele (listando todos os itens e o total) e atualize no sistema.
Sempre confirme o pedido completo antes de finalizar.
Pergunte o endereço de entrega e forma de pagamento.`,
      debounceSeconds: 5,
      sessionTimeout: 1800,
      isActive: true,
    },
  });
  console.log("✅ Bot settings created");

  // Create categories
  const catPaes = await prisma.category.upsert({
    where: { id: "cat-paes" },
    update: {},
    create: {
      id: "cat-paes",
      tenantId: tenant.id,
      name: "Pães",
      description: "Pães fresquinhos feitos na hora",
      sortOrder: 1,
    },
  });

  const catDoces = await prisma.category.upsert({
    where: { id: "cat-doces" },
    update: {},
    create: {
      id: "cat-doces",
      tenantId: tenant.id,
      name: "Doces & Bolos",
      description: "Delícias da nossa confeitaria",
      sortOrder: 2,
    },
  });

  const catBebidas = await prisma.category.upsert({
    where: { id: "cat-bebidas" },
    update: {},
    create: {
      id: "cat-bebidas",
      tenantId: tenant.id,
      name: "Bebidas",
      description: "Cafés, sucos e mais",
      sortOrder: 3,
    },
  });

  console.log("✅ Categories created");

  // Create products
  const products = [
    { id: "prod-1", categoryId: catPaes.id, name: "Pão Francês (un)", price: 0.75, sortOrder: 1 },
    { id: "prod-2", categoryId: catPaes.id, name: "Pão de Queijo (un)", price: 2.5, sortOrder: 2 },
    { id: "prod-3", categoryId: catPaes.id, name: "Pão Integral (un)", price: 1.2, sortOrder: 3 },
    { id: "prod-4", categoryId: catPaes.id, name: "Croissant", price: 5.0, sortOrder: 4 },
    { id: "prod-5", categoryId: catDoces.id, name: "Bolo de Cenoura (fatia)", price: 8.0, sortOrder: 1 },
    { id: "prod-6", categoryId: catDoces.id, name: "Bolo de Chocolate (fatia)", price: 9.0, sortOrder: 2 },
    { id: "prod-7", categoryId: catDoces.id, name: "Sonho", price: 4.5, sortOrder: 3 },
    { id: "prod-8", categoryId: catBebidas.id, name: "Café Expresso", price: 5.0, sortOrder: 1 },
    { id: "prod-9", categoryId: catBebidas.id, name: "Cappuccino", price: 8.0, sortOrder: 2 },
    { id: "prod-10", categoryId: catBebidas.id, name: "Suco de Laranja", price: 7.0, sortOrder: 3 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        ...p,
        tenantId: tenant.id,
        isAvailable: true,
      },
    });
  }
  console.log(`✅ ${products.length} products created`);

  console.log("\n🎉 Seed completed!");
  console.log(`\n📋 Tenant ID: ${tenant.id}`);
  console.log("Use this ID in your API calls (e.g., ?tenantId=" + tenant.id + ")");

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
