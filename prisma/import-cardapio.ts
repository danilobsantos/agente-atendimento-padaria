import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import Redis from "ioredis";
import "dotenv/config";

interface CategorySeed {
  name: string;
  products: [string, number, string?][];
}

interface AdditionalGroupSeed {
  category: string | null;
  items: [string, number][];
}

const CATEGORIES: CategorySeed[] = [
  {
    name: "Matinais",
    products: [
      ["Francês com manteiga", 3],
      ["Francês na chapa", 4],
      ["Francês com requeijão", 6],
      ["Francês com requeijão na chapa", 8],
      ["Francês com requeijão na entrada", 13],
      ["Francês com Nutella", 11],
      ["Francês com Nutella na chapa", 13],
      ["Baguetinha com manteiga", 8],
      ["Baguetinha com manteiga na chapa", 10],
      ["Baguetinha na chapa com requeijão", 15],
      ["Baguetinha com requeijão na entrada", 18],
    ],
  },
  {
    name: "Pão de queijo",
    products: [
      ["Pão de queijo - Presunto e muçarela", 8, "PEQUENO"],
      ["Pão de queijo - Presunto e muçarela", 15, "GRANDE"],
      ["Pão de queijo - Peito de peru e queijo prato", 8, "PEQUENO"],
      ["Pão de queijo - Peito de peru e queijo prato", 15, "GRANDE"],
      ["Pão de queijo - Requeijão", 8, "PEQUENO"],
      ["Pão de queijo - Requeijão", 15, "GRANDE"],
      ["Pão de queijo - Pernil", 8, "PEQUENO"],
      ["Pão de queijo - Pernil", 15, "GRANDE"],
      ["Pão de queijo - Linguiça", 8, "PEQUENO"],
      ["Pão de queijo - Linguiça", 15, "GRANDE"],
      ["Pão de queijo - Frango e requeijão", 8, "PEQUENO"],
      ["Pão de queijo - Frango e requeijão", 15, "GRANDE"],
      ["Pão de queijo - Na chapa", 8, "PEQUENO"],
      ["Pão de queijo - Na chapa", 15, "GRANDE"],
      ["Pão de queijo - Requeijão na entrada", 8, "PEQUENO"],
      ["Pão de queijo - Requeijão na entrada", 15, "GRANDE"],
      ["Pão de queijo - Queijo Canastra e geleia de pimenta defumada", 8, "PEQUENO"],
      ["Pão de queijo - Queijo Canastra e geleia de pimenta defumada", 15, "GRANDE"],
      ["Pão de queijo - Nutella", 8, "PEQUENO"],
      ["Pão de queijo - Nutella", 15, "GRANDE"],
      ["Pão de queijo - Queijo e goiabada", 8, "PEQUENO"],
      ["Pão de queijo - Queijo e goiabada", 15, "GRANDE"],
      ["Pão de queijo - Doce de leite", 8, "PEQUENO"],
      ["Pão de queijo - Doce de leite", 15, "GRANDE"],
    ],
  },
  {
    name: "Cafés",
    products: [
      ["Expresso", 5.5],
      ["Expresso canelinha", 7.5],
      ["Expresso carioca", 6.5],
      ["Expresso com espuma de leite", 7],
      ["Expresso duplo", 9],
      ["Da garrafa", 4.5],
      ["Com leite", 7],
      ["Com leite cremoso", 10],
      ["Chocolate quente cremoso", 10],
      ["Capuccino", 6.5],
      ["Capuccino de chocolate", 6.5],
      ["Capuccino de chocolate cremoso", 10],
      ["Mocca Ciok", 6.5],
      ["Copo de leite com Nescau", 6.5],
      ["Mocaccino", 14],
    ],
  },
  {
    name: "Gelados",
    products: [
      ["Frapuccino paçoquinha", 18],
      ["Café gelado pequeno", 16],
      ["Café gelado grande", 18],
      ["Café gelado com Nutella pequeno", 20],
      ["Café gelado com Nutella grande", 21.9],
      ["Soda italiana", 14],
      ["Milk shake", 19.9],
      ["Mickey shake", 24.9],
      ["Fini", 24.9],
    ],
  },
  {
    name: "Lanches",
    products: [
      ["Francês com salame", 9.5],
      ["Francês com mortadela tradicional", 6],
      ["Francês com mortadela defumada", 7],
      ["Francês com mortadela Ceratti", 12],
      ["Francês com ovo", 6],
      ["Francês com linguiça", 15],
      ["Francês com pernil", 15],
      ["Francês com salame e queijo", 16],
      ["Baguetinha com salame", 19.9],
      ["Baguetinha com salame e queijo", 22],
      ["Misto frio no pão francês", 8],
      ["Queijo quente no pão francês", 15],
      ["Na baguetinha", 18],
      ["Misto quente no pão francês", 15],
      ["Misto quente no mini pão francês ou caseirinho", 8],
      ["Misto quente na baguetinha - presunto e muçarela ou peito de peru e queijo prato", 19.9],
      ["Misto quente na baguetinha - mortadela Ceratti e queijo", 21],
      ["Biscoitão - misto quente", 19.9],
      ["Biscoitão - frango e requeijão", 19.9],
      ["Biscoitão - na chapa com manteiga", 10],
      ["Biscoitão - na chapa com requeijão", 15],
      ["Biscoitão - com requeijão na entrada", 18],
    ],
  },
  {
    name: "Bauru",
    products: [
      ["Bauru - Filé", 34.9],
      ["Bauru - Frango", 25.9],
      ["Bauru - Linguiça", 22.9],
      ["Bauru - Pernil", 28.9],
    ],
  },
  {
    name: "Hambúrguer",
    products: [
      ["América Burguer", 34.9],
      ["América Salada Burguer", 39.9],
    ],
  },
  {
    name: "Fitness",
    products: [
      ["Natural no francês", 16],
      ["Natural no francês integral", 19],
      ["Natural no sírio", 16],
      ["Natural na baguetinha", 18],
      ["Lanche natural de presunto Parma", 34.9],
    ],
  },
  {
    name: "Ovos",
    products: [
      ["Omelete", 12],
      ["Omelete completo", 18],
      ["Ovos mexidos", 9],
    ],
  },
  {
    name: "Tapioca",
    products: [
      ["Tapioca com manteiga", 14],
      ["Tapioca com presunto e muçarela", 18.9],
      ["Tapioca com frango e requeijão", 21],
      ["Tapioca com ovos mexidos", 18.9],
      ["Tapioca com peito de peru e queijo fresco", 19.9],
      ["Tapioca com Nutella", 21],
      ["Tapioca com Nutella e morango", 24.9],
      ["Tapioca com leite condensado e coco", 19.9],
    ],
  },
  {
    name: "Salada de frutas",
    products: [["Salada de frutas grande", 15]],
  },
  {
    name: "Açaí",
    products: [["Açaí", 14]],
  },
  {
    name: "Saladas",
    products: [
      ["Folhas verdes", 19.9],
      ["Salada Caesar", 25.9],
      ["Salada de palmito com presunto Parma", 34.9],
      ["Salada tropical", 34.9],
    ],
  },
  {
    name: "Pratos",
    products: [["Do dia", 29.9]],
  },
  {
    name: "Massas",
    products: [
      ["Panqueca", 34.9],
      ["Nhoque de batata ao molho bolonhesa", 24.9],
    ],
  },
  {
    name: "Porção",
    products: [
      ["Batata frita", 19.9],
      ["Batata frita com queijo e bacon", 26.9],
      ["Batata frita com creme de queijo", 29.9],
    ],
  },
  {
    name: "Sucos",
    products: [
      ["Suco de açaí com leite", 14],
      ["Suco de açaí com laranja", 16],
      ["Natural de laranja", 9.5],
      ["Natural com polpa", 15],
      ["Suco com água", 9.5],
      ["Suco com leite", 12],
      ["Frapê de coco", 13],
      ["Vitamina", 16],
    ],
  },
  {
    name: "Suco detox",
    products: [
      ["Detox laranja", 16],
      ["Detox roxo", 16],
      ["Detox verde", 16],
      ["Detox Vita C", 16],
      ["Detox termogênico", 16],
    ],
  },
];

// Groups map to the category where the extra applies; null = Geral
const ADDITIONAL_GROUPS: AdditionalGroupSeed[] = [
  { category: "Cafés", items: [["Borda de Nutella", 2.5], ["Chantilly", 2], ["Doce de leite", 4]] },
  { category: "Gelados", items: [["Nutella", 4], ["Ovomaltine", 3]] },
  { category: "Lanches", items: [["Geleia de pimenta defumada", 3], ["Bacon", 3], ["Ovo", 2], ["Milho", 1.5], ["Pão francês integral", 2.5]] },
  { category: "Lanches", items: [["Bacon", 4], ["Ovo", 4], ["Milho", 2], ["Geleia de pimenta", 5]] },
  { category: "Lanches", items: [["Pão francês integral", 2.5], ["Ovo", 2], ["Bacon", 2.5]] },
  { category: "Lanches", items: [["Bacon", 4], ["Ovo", 4]] },
  { category: "Fitness", items: [["Milho", 3], ["Palmito", 5], ["Frango", 5]] },
  { category: "Fitness", items: [["Milho", 1.5], ["Palmito", 3], ["Frango", 3]] },
  { category: "Ovos", items: [["Bacon", 3], ["Muçarela", 4], ["Queijo fresco", 4]] },
  { category: "Salada de frutas", items: [["Suco de laranja", 2], ["Mel", 4], ["Granola", 2.5], ["Chantilly", 2], ["Leite condensado", 2], ["Sorvete de creme (1 bola)", 6]] },
  { category: "Açaí", items: [["Leite Ninho", 3.5], ["Leite condensado", 2], ["Morango", 3], ["Banana", 2], ["Granola", 2.5], ["Chantilly", 2]] },
  { category: "Sucos", items: [["Leite condensado", 2]] },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

  const tenant = await prisma.tenant.findFirst({ where: { active: true } });
  if (!tenant) {
    console.error("❌ Nenhum tenant ativo encontrado.");
    process.exit(1);
  }

  // 1. Wipe current menu tables for the tenant
  await prisma.additionalItem.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
  console.log("🧹 Tabelas de cardápio limpas (additional_items, products, categories)");

  // 2. Categories
  const categoryIdByName = new Map<string, string>();
  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = await prisma.category.create({
      data: { tenantId: tenant.id, name: CATEGORIES[i].name, sortOrder: i + 1 },
    });
    categoryIdByName.set(category.name, category.id);
  }
  console.log(`✅ ${CATEGORIES.length} categorias criadas`);

  // 3. Products
  let productCount = 0;
  for (const category of CATEGORIES) {
    const categoryId = categoryIdByName.get(category.name)!;
    for (let i = 0; i < category.products.length; i++) {
      const [name, price, size] = category.products[i];
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          categoryId,
          name: size ? `${name} (${size})` : name,
          price,
          isAvailable: true,
          sortOrder: i + 1,
        },
      });
      productCount++;
    }
  }
  console.log(`✅ ${productCount} produtos criados`);

  // 4. Additional items
  let additionalCount = 0;
  for (const group of ADDITIONAL_GROUPS) {
    const categoryId = group.category ? categoryIdByName.get(group.category) ?? null : null;
    for (let i = 0; i < group.items.length; i++) {
      const [name, price] = group.items[i];
      await prisma.additionalItem.create({
        data: {
          tenantId: tenant.id,
          categoryId,
          name,
          price,
          isAvailable: true,
          sortOrder: i + 1,
        },
      });
      additionalCount++;
    }
  }
  console.log(`✅ ${additionalCount} itens adicionais criados`);

  // 5. Clear bot product cache so it does not serve stale items
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redis = new Redis(redisUrl);
  try {
    await redis.del(`cache:products:${tenant.id}`);
    console.log("🗑️  Cache Redis de produtos limpo");
  } finally {
    redis.quit();
  }

  console.log("\n🎉 Importação concluída!");
  console.log(`📋 Tenant: ${tenant.name} (${tenant.id})`);

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Importação falhou:", e);
  process.exit(1);
});
