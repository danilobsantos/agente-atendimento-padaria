import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// O endpoint precisa ser alcançável pelo browser: a URL assinada vai num
// redirect 302 de /api/media/[...key], então em produção use um host público.
const endpoint = process.env.MINIO_ENDPOINT || "http://localhost:9000";
const bucket = process.env.MINIO_BUCKET || "padaria-files";

export const s3 = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "padaria",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "padaria123",
  },
});

// O create-bucket é idempotente: 409 de bucket existente é normal.
let bucketReady: Promise<void> | null = null;
async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = s3
      .send(new CreateBucketCommand({ Bucket: bucket }))
      .then(() => undefined)
      .catch((err) => {
        if (err?.name !== "BucketAlreadyOwnedByYou") throw err;
      });
  }
  await bucketReady;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await ensureBucket();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

/**
 * Lê o stream do objeto do MinIO/S3 diretamente para streaming HTTP via route handler,
 * com suporte nativo a cabeçalho Range (essencial para buscar trechos de áudio e vídeo).
 */
export async function getObject(key: string, range?: string): Promise<{
  body: any;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  status: number;
} | null> {
  await ensureBucket();
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: range,
      })
    );
    return {
      body: res.Body,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
      status: range && res.ContentRange ? 206 : 200,
    };
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey") {
      return null;
    }
    console.error("[storage] getObject falhou:", err);
    return null;
  }
}

// Presign curto: a DB nunca guarda URL assinada; /api/media assina a cada acesso.
export async function presignedGet(key: string, seconds = 60): Promise<string> {
  await ensureBucket();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: seconds });
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    console.error("[storage] delete falhou:", err);
  }
}
