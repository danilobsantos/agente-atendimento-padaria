import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/utils/auth-route";
import AlertsList from "./AlertsList";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const alerts = await prisma.alert.findMany({
    where: { tenantId: user.tenantId, status: { in: ["open", "ack"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Critical primeiro. Alfabeticamente "critical" < "info" < "warn", então
  // orderBy no banco colocaria o alerta mais grave por último.
  const rank: Record<string, number> = { critical: 0, warn: 1, info: 2 };
  alerts.sort(
    (a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-5xl bg-[#FAF7F2]">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-950">Alertas</h1>
        <p className="text-sm text-[#6B5A4B] mt-2 font-light">
          O que precisa de uma pessoa: erro do bot, preço incoerente, pedido de atendimento humano e teto de
          gasto de IA. Um alerta aberto por assunto — não uma enxurrada.
        </p>
      </div>

      <AlertsList initialAlerts={JSON.parse(JSON.stringify(alerts))} />
    </div>
  );
}
