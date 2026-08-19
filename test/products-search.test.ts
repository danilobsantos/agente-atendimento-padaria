import "dotenv/config";
import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { redisKey, redisPub, redisSub } from "../src/lib/redis";
import { ProductsService } from "../src/lib/services/products.service";

const TENANT_ID = "33333333-3333-3333-3333-333333333333";
const P_CAPUCCINO = "33333333-0000-0000-0000-000000000001";

const P_PAO_FRANGO = "33333333-0000-0000-0000-000000000002";
const P_BOLO_CHOCOLATE = "33333333-0000-0000-0000-000000000003";
const P_PAO_FRANCES_MANTEIGA = "33333333-0000-0000-0000-000000000004";

beforeEach(async () => {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  await redisPub.del(redisKey("cache", "products", TENANT_ID));
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "Teste", slug: `test-${TENANT_ID}` } });
  await prisma.product.createMany({
    data: [
      { id: P_CAPUCCINO, tenantId: TENANT_ID, name: "Capuccino", price: 8 },
      { id: P_PAO_FRANGO, tenantId: TENANT_ID, name: "Pão de queijo - Frango e requeijão", price: 12 },
      { id: P_BOLO_CHOCOLATE, tenantId: TENANT_ID, name: "Bolo de chocolate", price: 15 },
      { id: P_PAO_FRANCES_MANTEIGA, tenantId: TENANT_ID, name: "Francês com manteiga", price: 5 },
    ],
  });
});

afterEach(async () => {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  await redisPub.del(redisKey("cache", "products", TENANT_ID));
});

after(async () => {
  await prisma.$disconnect();
  redisPub.disconnect();
  redisSub.disconnect();
});

test("busca tolera grafia do cardápio ('cappuccino' encontra 'Capuccino')", async () => {
  const results = await ProductsService.searchProducts(TENANT_ID, { busca: "cappuccino" });
  assert.ok(results.some((p) => p.id === P_CAPUCCINO));
});

test("busca tolera erro de digitação do cliente ('cappucino' encontra 'Capuccino')", async () => {
  const results = await ProductsService.searchProducts(TENANT_ID, { busca: "cappucino" });
  assert.ok(results.some((p) => p.id === P_CAPUCCINO));
});

test("busca divergente não retorna falso positivo", async () => {
  const results = await ProductsService.searchProducts(TENANT_ID, { busca: "espaguete" });
  assert.equal(results.some((p) => p.id === P_CAPUCCINO), false);
});

test("busca curta continua exata (sem falso positivo)", async () => {
  const results = await ProductsService.searchProducts(TENANT_ID, { busca: "caf" });
  assert.equal(results.some((p) => p.id === P_CAPUCCINO), false);
});

test("busca composta tokenizada ('pão de queijo com frango' encontra 'Pão de queijo - Frango e requeijão')", async () => {
  const results = await ProductsService.searchProducts(TENANT_ID, { busca: "pão de queijo com frango" });
  assert.ok(results.some((p) => p.id === P_PAO_FRANGO));
});

test("busca composta simplificada ('bolo chocolate' encontra 'Bolo de chocolate')", async () => {
  const results = await ProductsService.searchProducts(TENANT_ID, { busca: "bolo chocolate" });
  assert.ok(results.some((p) => p.id === P_BOLO_CHOCOLATE));
});

test("busca com stop words ('pão francês com manteiga' encontra 'Francês com manteiga')", async () => {
  const results = await ProductsService.searchProducts(TENANT_ID, { busca: "pão francês com manteiga" });
  assert.ok(results.some((p) => p.id === P_PAO_FRANCES_MANTEIGA));
});