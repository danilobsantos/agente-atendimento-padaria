import "dotenv/config";
import { test, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { redisKey, redisPub, redisSub } from "../src/lib/redis";
import { ProductsService } from "../src/lib/services/products.service";

const TENANT_ID = "33333333-3333-3333-3333-333333333333";
const P_CAPUCCINO = "33333333-0000-0000-0000-000000000001";

beforeEach(async () => {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
  await redisPub.del(redisKey("cache", "products", TENANT_ID));
  await prisma.tenant.create({ data: { id: TENANT_ID, name: "Teste", slug: `test-${TENANT_ID}` } });
  await prisma.product.create({
    data: { id: P_CAPUCCINO, tenantId: TENANT_ID, name: "Capuccino", price: 8 },
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