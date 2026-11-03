import { prisma } from "@/lib/prisma";
import { redisChannel, redisPub } from "@/lib/redis";

export type AlertSeverity = "info" | "warn" | "critical";

export type AlertKind =
  | "bot_erro"
  | "provedor_fora_do_ar"
  | "handoff"
  | "preco_incoerente"
  | "prazo_inventado"
  | "orcamento_estourado"
  | "pedido_abandonado";

export interface RaiseAlertInput {
  tenantId: string;
  kind: AlertKind;
  severity?: AlertSeverity;
  title: string;
  body?: string;
  refKind?: string;
  refId?: string;
}

/**
 * Central de alertas.
 *
 * Regra: no máximo UM alerta aberto por (tenant, kind, ref). Alarme repetido
 * treina o dono a ignorar o alarme certo — se o bot falha 40x no mesmo cliente,
 * o painel mostra um card com "40 ocorrências", não 40 cards.
 *
 * Nunca lança: um alerta que derruba o fluxo que ele deveria reportar é pior
 * que alerta nenhum.
 */
export async function raiseAlert(input: RaiseAlertInput): Promise<void> {
  try {
    const existing = await prisma.alert.findFirst({
      where: {
        tenantId: input.tenantId,
        kind: input.kind,
        status: "open",
        refKind: input.refKind ?? null,
        refId: input.refId ?? null,
      },
      select: { id: true },
    });
    if (existing) return;

    const alert = await prisma.alert.create({
      data: {
        tenantId: input.tenantId,
        kind: input.kind,
        severity: input.severity ?? "warn",
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 4000) ?? null,
        refKind: input.refKind ?? null,
        refId: input.refId ?? null,
      },
    });

    await redisPub.publish(
      redisChannel("tenant", input.tenantId, "alert"),
      JSON.stringify({ id: alert.id, kind: alert.kind, severity: alert.severity, title: alert.title }),
    );
  } catch (err) {
    console.warn("[alert] não foi possível registrar alerta:", err);
  }
}
