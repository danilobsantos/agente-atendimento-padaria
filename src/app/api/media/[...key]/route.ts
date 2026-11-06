import { NextResponse } from "next/server";
import { getObject } from "@/lib/storage";

// Público de propósito: as imagens de produto aparecem no /cardapio anônimo e
// a mídia de chat é protegida pelo UUID da key — quem não conhece a key não baixa.
// Transmite o arquivo diretamente do MinIO/S3 para evitar problemas de portas locais
// (ex.: localhost:9000 inacessível a partir de celulares/rede externa) e bloqueios de CORS.
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  if (!key.length || key.some((seg) => !seg || seg.includes(".."))) {
    return new NextResponse("bad key", { status: 400 });
  }

  try {
    const fileKey = key.join("/");
    const range = request.headers.get("range") || undefined;
    const obj = await getObject(fileKey, range);
    if (!obj || !obj.body) {
      return new NextResponse("not found", { status: 404 });
    }

    const stream = typeof obj.body.transformToWebStream === "function"
      ? obj.body.transformToWebStream()
      : obj.body;

    const headers = new Headers();
    headers.set("Content-Type", obj.contentType || "application/octet-stream");
    if (obj.contentLength !== undefined) headers.set("Content-Length", String(obj.contentLength));
    if (obj.contentRange) headers.set("Content-Range", obj.contentRange);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(stream, {
      status: obj.status,
      headers,
    });
  } catch (err) {
    console.error("[api/media] erro ao servir mídia:", err);
    return new NextResponse("not found", { status: 404 });
  }
}
