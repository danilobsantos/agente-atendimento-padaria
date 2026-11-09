import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { refreshCustomerAvatar } from "../src/lib/services/media.service";
import { redisKey, redisPub } from "../src/lib/redis";

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  for (const tenant of tenants) {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: tenant.id,
        photoUrl: null,
        chatMessages: { some: {} }, // só clientes que já conversaram
      },
      select: { id: true, phone: true },
      orderBy: { createdAt: "desc" },
    });

    console.log(`\n[${tenant.name || tenant.id}] ${customers.length} clientes sem foto para processar`);

    let saved = 0;
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      // Remove a trava antiga (de antes da correção) para permitir a tentativa.
      await redisPub.del(redisKey("avatar_attempt", tenant.id, customer.id));

      await refreshCustomerAvatar(tenant.id, customer.id, customer.phone);

      const updated = await prisma.customer.findUnique({
        where: { id: customer.id },
        select: { photoUrl: true },
      });
      if (updated?.photoUrl) saved++;

      if ((i + 1) % 20 === 0 || i + 1 === customers.length) {
        console.log(`  ${i + 1}/${customers.length} — ${saved} fotos salvas`);
      }

      // Intervalo de cortesia para não sobrecarregar Evolution Go / CDN do WhatsApp
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    console.log(`  Concluído: ${saved}/${customers.length} fotos salvas`);
  }

  await prisma.$disconnect();
  await redisPub.quit();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

