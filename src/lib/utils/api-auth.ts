import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/utils/auth-route";
import type { JWTPayload } from "@/lib/auth";

/**
 * `src/middleware.ts` exclui `/api` do matcher, então toda rota depende de auth
 * própria. O tenant vem SEMPRE do JWT — `?tenantId=` da query é dado de atacante.
 */
export async function requireUser(): Promise<JWTPayload | null> {
  return getAuthUser();
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
}

/**
 * Secreto compartilhado entre o webhook e o process-bot. Sem ele qualquer um
 * dispara o LLM em loop e queima o crédito da conta.
 */
export function botSecret(): string {
  return process.env.BOT_INTERNAL_SECRET || process.env.JWT_SECRET || "";
}

let warnedMissingSecret = false;

export function isAuthorizedBotRequest(request: Request): boolean {
  // O runner de teste chama o handler direto, sem passar pelo webhook.
  if (process.env.NODE_ENV === "test") return true;

  const configured = botSecret();
  if (configured === "") {
    // Dev sem env: não bloqueia para não travar o setup local, mas avisa alto.
    if (process.env.NODE_ENV !== "production") {
      if (!warnedMissingSecret) {
        warnedMissingSecret = true;
        console.warn("[auth] BOT_INTERNAL_SECRET/JWT_SECRET ausente — chamada interna sem verificação.");
      }
      return true;
    }
    return false;
  }
  return request.headers.get("x-bot-secret") === configured;
}
