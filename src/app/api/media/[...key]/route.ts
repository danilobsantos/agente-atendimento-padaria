import { NextResponse } from "next/server";
import { presignedGet } from "@/lib/storage";

// Público de propósito: as imagens de produto aparecem no /cardapio anônimo e
// a mídia de chat é protegida pelo UUID da key — quem não conhece a key não baixa.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  if (!key.length || key.some((seg) => !seg || seg.includes(".."))) {
    return new NextResponse("bad key", { status: 400 });
  }

  try {
    const target = await presignedGet(key.join("/"));
    return NextResponse.redirect(target, 302);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
