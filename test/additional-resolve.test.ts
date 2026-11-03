import "dotenv/config";
import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { OrdersService } from "../src/lib/services/orders.service";

const TENANT_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(async () => {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "Teste Extras", slug: `test-${TENANT_ID}` } });
});

afterEach(async () => {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
});

after(async () => {
  await prisma.$disconnect();
});

async function seed() {
  const catAcai = await prisma.category.create({ data: { tenantId: TENANT_ID, name: "Açaís" } });
  const catLanches = await prisma.category.create({ data: { tenantId: TENANT_ID, name: "Lanches" } });

  await prisma.additionalItem.createMany({
    data: [
      { tenantId: TENANT_ID, name: "Nutella", price: 4 }, // global
      { tenantId: TENANT_ID, name: "Nutella", price: 6, categoryId: catAcai.id },
      { tenantId: TENANT_ID, name: "Creme de Açaí", price: 5, categoryId: catAcai.id },
      { tenantId: TENANT_ID, name: "Cheddar", price: 3, categoryId: catLanches.id },
    ],
  });

  return catAcai.id;
}

test("nome homônimo casa com o extra da categoria do produto, não com o first-wins tenant-wide", async () => {
  const catAcai = await seed();
  const extras = await prisma.additionalItem.findMany({ where: { tenantId: TENANT_ID, isAvailable: true } });

  const { matched } = OrdersService.matchAdditionalItems(extras, [{ name: "Nutella" }], catAcai);

  assert.equal(matched.length, 1);
  assert.equal(matched[0].price, 6);
});

test("fuzzy tolera variação de nome no escopo do produto", async () => {
  const catAcai = await seed();
  const extras = await prisma.additionalItem.findMany({ where: { tenantId: TENANT_ID, isAvailable: true } });

  const { matched } = OrdersService.matchAdditionalItems(extras, [{ name: "creme de nutella" }], catAcai);

  assert.equal(matched[0].name, "Nutella");
  assert.equal(matched[0].price, 6);
});

test("busca sem acento casa com nome acentuado do catálogo", async () => {
  const catAcai = await seed();
  const extras = await prisma.additionalItem.findMany({ where: { tenantId: TENANT_ID, isAvailable: true } });

  const { matched } = OrdersService.matchAdditionalItems(extras, [{ name: "acai" }], catAcai);

  assert.equal(matched[0].name, "Creme de Açaí");
});

test("id desconhecido cai para o nome exato tenant-wide (eco de carrinho após editar menu)", async () => {
  await seed();
  const extras = await prisma.additionalItem.findMany({ where: { tenantId: TENANT_ID, isAvailable: true } });

  const { matched } = OrdersService.matchAdditionalItems(
    extras,
    [{ id: "id-zero-do-llm", name: "Cheddar" }],
    null // produto categoryless
  );

  assert.equal(matched[0].name, "Cheddar");
  assert.equal(matched[0].price, 3);
});

test("adicional inexistente é descartado, reportado e não inventa preço", async () => {
  const catAcai = await seed();
  const extras = await prisma.additionalItem.findMany({ where: { tenantId: TENANT_ID, isAvailable: true } });

  const { matched, unmatched } = OrdersService.matchAdditionalItems(extras, [{ name: "Powerade" }], catAcai);

  assert.equal(matched.length, 0);
  assert.deepEqual(unmatched, ["Powerade"]);
});
