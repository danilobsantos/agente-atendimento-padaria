import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/utils/auth-route";
import { evolutionGo } from "@/lib/services/evolution-go";

export const dynamic = "force-dynamic";

// POST /api/evolution/connect — cria/garante a instância e retorna o QR code
export async function POST() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    await evolutionGo.ensureInstance(`${appUrl}/api/webhooks/evolution`);

    // O /instance/qr pode retornar vazio logo após a criação da instância.
    // Cada call do GetQr auto-inicia o cliente se nenhum existir — espaçar os
    // retries para não pressionar o pool de conexões do servidor da Evolution.
    let qr = await evolutionGo.getQrCode();
    for (let i = 0; i < 5 && !qr.base64 && !qr.alreadyConnected; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      qr = await evolutionGo.getQrCode();
    }

    if (qr.alreadyConnected) {
      return NextResponse.json(
        { message: "O número já está conectado. Verifique o status na página." },
        { status: 200 }
      );
    }

    if (!qr.base64 && !qr.code) {
      return NextResponse.json(
        { error: "QR code indisponível. Verifique se a Evolution Go está rodando e se a instância está criada." },
        { status: 502 }
      );
    }

    return NextResponse.json(qr);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || "Falha ao conectar na Evolution Go" },
      { status: 502 }
    );
  }
}