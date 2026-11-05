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
  const video = message.videoMessage as { caption?: string; mimetype?: string } | undefined;
  if (video) return { mediaType: "video", mimetype: video.mimetype || "video/mp4", fallbackText: video.caption || "[Vídeo]" };
  const doc = message.documentMessage as { caption?: string; mimetype?: string; fileName?: string } | undefined;
  if (doc) return { mediaType: "document", mimetype: doc.mimetype || "application/octet-stream", fallbackText: doc.caption || doc.fileName || "[Documento]" };

  const sticker = message.stickerMessage as { mimetype?: string } | undefined;
  if (sticker) return { mediaType: "image", mimetype: sticker.mimetype || "image/webp", fallbackText: "[Figurinha]" };
  return null;
}

/**
 * Baixa a mídia no Evolution Go (/message/downloadmedia recebe o waE2E.Message
 * cru que o webhook passou por parâmetro), sobe para o MinIO e devolve key +
 * projeção de texto. null = não é mídia (ou falhou e o fluxo segue com o texto).
 */
export async function ingestInboundMedia(tenantId: string, rawMessage: unknown): Promise<IngestedMedia | null> {
  if (!rawMessage || typeof rawMessage !== "object") return null;
  const detection = detectMedia(rawMessage as Record<string, unknown>);
  if (!detection) return null;

  try {
    const service = await getEvolutionServiceForTenant(tenantId);
    const media = await service.downloadMedia(rawMessage);
    if (!media || media.buffer.length > MAX_BYTES) {
      console.error("[media] download vazio/excedido:", detection.mediaType);
      return { mediaKey: "", mediaType: detection.mediaType, text: detection.fallbackText };
    }

    const ext = extFromMimetype(detection.mimetype);
    const key = `media/${tenantId}/${crypto.randomUUID()}.${ext}`;
    await putObject(key, media.buffer, detection.mimetype);

    let text = detection.fallbackText;
    if (detection.mediaType === "audio") {
      const transcript = await transcribeAudio(media.buffer, detection.mimetype);
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
 * Tentativas sem sucesso são limitadas a uma por dia por cliente.
 */
export async function refreshCustomerAvatar(tenantId: string, customerId: string, phone: string): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { photoUrl: true } });
    if (!customer || customer.photoUrl) return;

    // Não repita a chamada lenta a cada mensagem quando a Evolution não tem avatar.
    const { redisKey, redisPub } = await import("@/lib/redis");
    const acquired = await redisPub.set(redisKey("avatar_attempt", tenantId, customerId), "1", "EX", 86400, "NX");
    if (acquired !== "OK") return;

    const service = await getEvolutionServiceForTenant(tenantId);
    const url = await service.getAvatarUrl(phone);
    if (!url) return;

    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return;

    const key = `media/${tenantId}/avatars/${crypto.randomUUID()}.jpg`;
    await putObject(key, buffer, "image/jpeg");
    await prisma.customer.update({ where: { id: customerId }, data: { photoUrl: `/api/media/${key}` } });

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
