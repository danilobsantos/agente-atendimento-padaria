import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/utils/api-auth";
import { putObject } from "@/lib/storage";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// POST /api/products/image — multipart com campo "file"; devolve a URL que o
// admin salva em Product.imageUrl junto do produto.
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  let file: File;
  try {
    const form = await request.formData();
    const found = form.get("file");
    if (!(found instanceof File)) {
      return NextResponse.json({ error: "campo file obrigatório" }, { status: 400 });
    }
    file = found;
  } catch {
    return NextResponse.json({ error: "multipart inválido" }, { status: 400 });
  }

  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "formato aceito: JPG, PNG ou WebP" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "imagem acima de 5MB" }, { status: 400 });
  }

  try {
    const key = `products/${user.tenantId}/${crypto.randomUUID()}.${ext}`;
    await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ url: `/api/media/${key}` }, { status: 201 });
  } catch (error) {
    console.error("[Products] Upload de imagem falhou:", error);
    return NextResponse.json({ error: "Erro no upload" }, { status: 500 });
  }
}
