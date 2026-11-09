import { prisma } from "@/lib/prisma";
import { transcribeAudio } from "@/lib/speech";
import { putObject } from "@/lib/storage";
import { getEvolutionServiceForTenant } from "@/lib/services/evolution-go";

export type BotMediaType = "image" | "audio" | "video" | "document";

export interface IngestedMedia {
  mediaKey: string;
  mediaType: BotMediaType;
  /** Projeção de texto salva em ChatMessage.content (bot e lista leem só texto). */
  text: string;
}

interface MediaDetection {
  mediaType: BotMediaType;
  mimetype: string;
  fallbackText: string;
}

// 25 MB: WhatsApp aceita até ~64 MB, mas o processamento in-memory não precisa.
const MAX_BYTES = 25 * 1024 * 1024;

function extFromMimetype(mimetype: string): string {
  const base = (mimetype || "application/octet-stream").split(";")[0].trim();
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  };
  return known[base] ?? base.split("/")[1]?.split("+")[0] ?? "bin";
}

export function detectMedia(message: Record<string, unknown>): MediaDetection | null {
  const image = message.imageMessage as { caption?: string; mimetype?: string } | undefined;
  if (image) return { mediaType: "image", mimetype: image.mimetype || "image/jpeg", fallbackText: image.caption || "[Foto]" };
  const audio = message.audioMessage as { mimetype?: string; ptt?: boolean } | undefined;
  if (audio) return { mediaType: "audio", mimetype: audio.mimetype || "audio/ogg", fallbackText: "[Áudio]" };
  const video = (message.videoMessage || message.ptvMessage) as { caption?: string; mimetype?: string } | undefined;
  if (video) return { mediaType: "video", mimetype: video.mimetype || "video/mp4", fallbackText: video.caption || "[Vídeo]" };
  const doc = message.documentMessage as { caption?: string; mimetype?: string; fileName?: string } | undefined;
  if (doc) return { mediaType: "document", mimetype: doc.mimetype || "application/octet-stream", fallbackText: doc.caption || doc.fileName || "[Documento]" };

  const sticker = message.stickerMessage as { mimetype?: string } | undefined;
  if (sticker) return { mediaType: "image", mimetype: sticker.mimetype || "image/webp", fallbackText: "[Figurinha]" };
  return null;
}

/**
 * Processa a mídia recebida:
 * 1. Usa o base64 direto se o Evolution Go já entregou pré-baixado (ex.: WebhookFiles).
 * 2. Caso contrário, solicita o download via /message/downloadmedia no Evolution Go.
 * 3. Faz o upload para o MinIO/S3 e devolve a key gerada + projeção de texto.
 * null = não é mídia (ou falhou e o fluxo segue com o texto de fallback).
 */
export async function ingestInboundMedia(
  tenantId: string,
  rawMessage: unknown,
  outerPayload?: unknown
): Promise<IngestedMedia | null> {
  if (!rawMessage || typeof rawMessage !== "object") return null;
  const msgObj = rawMessage as Record<string, unknown>;
  const detection = detectMedia(msgObj);
  if (!detection) return null;

  try {
    let mediaBuffer: Buffer | null = null;
    let detectedMime = detection.mimetype;

    // 1. Checa se o webhook já veio com a mídia em base64
    const directBase64 =
      typeof msgObj.base64 === "string"
        ? msgObj.base64
        : outerPayload && typeof outerPayload === "object" && typeof (outerPayload as Record<string, unknown>).base64 === "string"
          ? ((outerPayload as Record<string, unknown>).base64 as string)
          : null;

    if (directBase64) {
      let b64 = directBase64;
      if (b64.startsWith("data:")) {
        const commaIdx = b64.indexOf(",");
        if (commaIdx !== -1) {
          const prefix = b64.slice(5, commaIdx);
          const semiIdx = prefix.indexOf(";");
          const extractedMime = semiIdx !== -1 ? prefix.slice(0, semiIdx) : prefix;
          if (extractedMime) detectedMime = extractedMime;
          b64 = b64.slice(commaIdx + 1);
        }
      } else {
        b64 = b64.replace(/^data:[^;]*;base64,/, "");
      }
      const buf = Buffer.from(b64, "base64");
      if (buf.length > 0 && buf.length <= MAX_BYTES) {
        mediaBuffer = buf;
      }
    }

    // 2. Se não veio direto em base64, solicita o download via Evolution Go
    if (!mediaBuffer) {
      const service = await getEvolutionServiceForTenant(tenantId);
      // Mapeia ptvMessage para videoMessage para que o endpoint de download do Evolution Go reconheça
      const payloadToSend = msgObj.ptvMessage && !msgObj.videoMessage
        ? { ...msgObj, videoMessage: msgObj.ptvMessage }
        : msgObj;

      const media = await service.downloadMedia(payloadToSend);
      if (media && media.buffer.length > 0 && media.buffer.length <= MAX_BYTES) {
        mediaBuffer = media.buffer;
        if (media.mimetype) detectedMime = media.mimetype;
      }
    }

    if (!mediaBuffer) {
      console.error("[media] download vazio ou falhou para:", detection.mediaType);
      return { mediaKey: "", mediaType: detection.mediaType, text: detection.fallbackText };
    }

    const ext = extFromMimetype(detectedMime);
    const key = `media/${tenantId}/${crypto.randomUUID()}.${ext}`;
    await putObject(key, mediaBuffer, detectedMime);

    let text = detection.fallbackText;
    if (detection.mediaType === "audio") {
      const transcript = await transcribeAudio(mediaBuffer, detectedMime);
      if (transcript) text = transcript;
    }

    return { mediaKey: key, mediaType: detection.mediaType, text };
  } catch (err) {
    // MinIO/Evolution fora: a mensagem de texto segue, a mídia vira placeholder.
    console.error("[media] ingestão falhou:", err);
    return { mediaKey: "", mediaType: detection.mediaType, text: detection.fallbackText };
  }
}

/**
 * Foto do contato: baixa o avatar da Evolution e grava em `Customer.photoUrl`.
 *
 * - Trava curta (30 min) apenas para evitar chamadas concorrentes do mesmo cliente.
 * - Contato sem foto/foto oculta: 24 h de cooldown.
 * - Erro transitório (timeout, rede, 5xx inesperado): mantém a trava curta e
 *   tenta de novo em 30 min.
 */
export async function refreshCustomerAvatar(
  tenantId: string,
  customerId: string,
  phone: string
): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { photoUrl: true },
    });
    if (!customer || customer.photoUrl) return;

    const { redisKey, redisPub } = await import("@/lib/redis");
    const lockKey = redisKey("avatar_attempt", tenantId, customerId);

    // Trava curta: evita várias buscas simultâneas para o mesmo contato.
    const acquired = await redisPub.set(lockKey, "1", "EX", 1800, "NX");
    if (acquired !== "OK") return;

    const service = await getEvolutionServiceForTenant(tenantId);

    let url: string | null;
    try {
      url = await service.getAvatarUrl(phone);
    } catch (err) {
      // Erro transitório: a trava curta expira em 30 min e a próxima mensagem tenta de novo.
      console.error("[media] avatar: falha transitória, nova tentativa em até 30 min:", err);
      return;
    }

    if (!url) {
      // Contato sem foto ou com foto oculta: não vale consultar a cada mensagem.
      await redisPub.expire(lockKey, 24 * 60 * 60);
      return;
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      // Falha no CDN do WhatsApp: mantém a trava curta para tentar de novo.
      console.warn("[media] avatar: download falhou:", response.status);
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return;

    // Avatares são pequenos; limite defensivo.
    if (buffer.length > 5 * 1024 * 1024) {
      console.warn("[media] avatar grande demais, ignorando:", buffer.length);
      return;
    }

    const rawType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    const contentType = rawType.startsWith("image/") ? rawType : "image/jpeg";
    const ext = extFromMimetype(contentType);

    const key = `media/${tenantId}/avatars/${crypto.randomUUID()}.${ext}`;
    await putObject(key, buffer, contentType);
    await prisma.customer.update({
      where: { id: customerId },
      data: { photoUrl: `/api/media/${key}` },
    });

    // Sucesso: mantém o cooldown; o photoUrl já evita novas buscas.
    await redisPub.expire(lockKey, 24 * 60 * 60);

    // Painel atualiza o avatar em tempo real junto com o evento de customer.
    const { redisChannel } = await import("@/lib/redis");
    await redisPub.publish(
      redisChannel("tenant", tenantId, "customer"),
      JSON.stringify({ customerId, photoUrl: `/api/media/${key}` })
    );
  } catch (err) {
    console.error("[media] avatar falhou:", err);
  }
}
