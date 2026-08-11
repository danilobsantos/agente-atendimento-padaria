import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/utils/auth-route";
import { evolutionGo } from "@/lib/services/evolution-go";

export const dynamic = "force-dynamic";

// GET /api/evolution/status — estado da conexão do dispositivo (Evolution Go)
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const status = await evolutionGo.getStatus();
    return NextResponse.json(status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message || "Falha ao consultar status da Evolution Go", connected: false, loggedIn: false },
      { status: 502 }
    );
  }
}