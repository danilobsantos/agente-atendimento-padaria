import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import Redis from "ioredis";
import { S3Client, PutObjectCommand, CreateBucketCommand } from "@aws-sdk/client-s3";

// ─── Conexões Autocontidas (compatíveis com o container runner do Docker) ───

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisPrefix = (process.env.REDIS_PREFIX || "ag_delivery").replace(/:+$/, "");
const redisPub = new Redis(redisUrl);

function redisKey(...parts: string[]): string {
  return [redisPrefix, ...parts].join(":");
}

const s3Endpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000";
const s3Bucket = process.env.MINIO_BUCKET || "padaria-files";

const s3 = new S3Client({
  endpoint: s3Endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "padaria",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "padaria123",
  },
});

let bucketEnsured = false;
async function ensureBucket() {
  if (bucketEnsured) return;
  try {
    await s3.send(new CreateBucketCommand({ Bucket: s3Bucket }));
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error?.name !== "BucketAlreadyOwnedByYou") throw err;
  }
  bucketEnsured = true;
}

async function putObject(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

async function getAvatarUrl(
  baseUrl: string,
  apikey: string,
  number: string
): Promise<string | null> {
  const clean = number.replace(/\D/g, "");
  if (!clean && !number.includes("@")) return null;
  const jid = number.includes("@") ? number : `${clean}@s.whatsapp.net`;

  try {
    const res = await fetch(`${baseUrl}/user/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey,
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ number: jid, preview: false }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (
        /does not have a profile picture/i.test(errText) ||
        /hidden their profile picture/i.test(errText) ||
        /item-not-found/i.test(errText)
      ) {
        return null;
      }
      throw new Error(`Evolution Go error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      url?: string;
      link?: string;
      data?: { url?: string };
      result?: { url?: string };
    };
    return data.url ?? data.link ?? data.data?.url ?? data.result?.url ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      /does not have a profile picture/i.test(message) ||
      /hidden their profile picture/i.test(message) ||
      /item-not-found/i.test(message)
    ) {
      return null;
    }
    throw err;
  }
}

async function main() {
  console.log("🚀 Iniciando backfill de avatares dos clientes...");

  const tenants = await prisma.tenant.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const defaultBaseUrl = (process.env.EVOLUTION_API_URL || "http://localhost:8080").replace(/\/+$/, "");

  for (const tenant of tenants) {
    const botSetting = await prisma.botSetting.findUnique({
      where: { tenantId: tenant.id },
    });

    const baseUrl = defaultBaseUrl;
    const apikey =
      botSetting?.evolutionInstanceToken ||
      process.env.EVOLUTION_INSTANCE_TOKEN ||
      process.env.EVOLUTION_API_KEY ||
      "";

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
    if (!customers.length) continue;

    let saved = 0;
    let noPhoto = 0;
    let failed = 0;

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const lockKey = redisKey("avatar_attempt", tenant.id, customer.id);

      // Remove trava antiga antes de tentar
      await redisPub.del(lockKey);

      try {
        let url: string | null = null;
        try {
          url = await getAvatarUrl(baseUrl, apikey, customer.phone);
        } catch (evoErr) {
          failed++;
          console.error(`  ⚠️ [${customer.phone}] Erro ao chamar Evolution:`, evoErr instanceof Error ? evoErr.message : evoErr);
          continue;
        }

        if (!url) {
          noPhoto++;
          // Marca no Redis por 24h para não reconsultar
          await redisPub.set(lockKey, "1", "EX", 86400);
          continue;
        }

        const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) {
          failed++;
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
          failed++;
          continue;
        }

        const rawType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
        const contentType = rawType.startsWith("image/") ? rawType : "image/jpeg";
        const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";

        const key = `media/${tenant.id}/avatars/${crypto.randomUUID()}.${ext}`;
        await putObject(key, buffer, contentType);

        await prisma.customer.update({
          where: { id: customer.id },
          data: { photoUrl: `/api/media/${key}` },
        });

        await redisPub.set(lockKey, "1", "EX", 86400);

        await redisPub.publish(
          `${redisPrefix}:tenant:${tenant.id}:customer`,
          JSON.stringify({ customerId: customer.id, photoUrl: `/api/media/${key}` })
        );

        saved++;
      } catch (err) {
        failed++;
        console.error(`  ❌ [${customer.phone}] Falha geral ao processar avatar:`, err);
      } finally {
        if ((i + 1) % 20 === 0 || i + 1 === customers.length) {
          console.log(`  Progresso: ${i + 1}/${customers.length} — ${saved} fotos salvas, ${noPhoto} sem foto, ${failed} falhas`);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    console.log(`  🏁 Finalizado [${tenant.name || tenant.id}]: ${saved} fotos salvas | ${noPhoto} sem foto pública | ${failed} falhas`);
  }

  await prisma.$disconnect();
  await pool.end();
  redisPub.disconnect();
  console.log("\n✅ Backfill concluído!");
}

main().catch(async (err) => {
  console.error("Erro fatal no backfill:", err);
  await prisma.$disconnect();
  await pool.end();
  redisPub.disconnect();
  process.exit(1);
});
