import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/utils/auth-route";
import { monthlySpendCents } from "@/lib/llm/runner";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

// Fora do componente: o React Compiler acusa Date.now() durante o render.
function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * DAY);
}

function usd(cents: number): string {
  return `US$ ${(cents / 100).toFixed(2)}`;
}

export default async function MetricasPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const since = sevenDaysAgo();

  const [totals, errors, byModel, spend, settings, openAlerts] = await Promise.all([
    prisma.llmCall.aggregate({
      where: { tenantId: user.tenantId, createdAt: { gte: since } },
      _count: { id: true },
      _avg: { latencyMs: true },
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
    }),
    prisma.llmCall.count({
      where: { tenantId: user.tenantId, createdAt: { gte: since }, status: "error" },
    }),
    prisma.llmCall.groupBy({
      by: ["model"],
      where: { tenantId: user.tenantId, createdAt: { gte: since } },
      _count: { id: true },
      _avg: { latencyMs: true },
      _sum: { costCents: true },
    }),
    monthlySpendCents(user.tenantId),
    prisma.botSetting.findUnique({ where: { tenantId: user.tenantId }, select: { monthlyBudgetCents: true } }),
    prisma.alert.count({ where: { tenantId: user.tenantId, status: "open" } }),
  ]);

  const calls = totals._count.id;
  const errorRate = calls > 0 ? (errors / calls) * 100 : 0;
  const budget = settings?.monthlyBudgetCents ?? 0;
  const spent = spend ?? 0;
  const budgetPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  const cards = [
    { label: "Chamadas de IA (7 dias)", value: String(calls) },
    { label: "Latência média", value: `${Math.round(totals._avg.latencyMs ?? 0)} ms` },
    { label: "Taxa de erro", value: `${errorRate.toFixed(1)}%`, danger: errorRate > 5 },
    { label: "Tokens (in/out)", value: `${totals._sum.inputTokens ?? 0} / ${totals._sum.outputTokens ?? 0}` },
    { label: "Custo (7 dias)", value: usd(totals._sum.costCents ?? 0) },
    { label: "Alertas abertos", value: String(openAlerts), danger: openAlerts > 0 },
  ];

  return (
    <div className="p-8 space-y-8 flex-1 overflow-y-auto max-w-5xl bg-[#FAF7F2]">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-amber-950">Métricas da IA</h1>
        <p className="text-sm text-[#6B5A4B] mt-2 font-light">
          Uma linha por chamada ao provedor. Custo em dólar porque é assim que a fatura chega.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-[#EBE2D5] rounded-2xl p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#8C7A6B]">{card.label}</p>
            <p className={`text-2xl font-bold mt-2 ${card.danger ? "text-rose-700" : "text-amber-950"}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-amber-950">Teto mensal de gasto</h2>
          <span className="text-sm text-[#6B5A4B]">
            {usd(spent)} {budget > 0 ? `de ${usd(budget)}` : "— sem teto configurado"}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[#F5EFE6] overflow-hidden">
          <div
            className={`h-full rounded-full ${budgetPct >= 100 ? "bg-rose-600" : budgetPct >= 80 ? "bg-amber-500" : "bg-emerald-600"}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <p className="text-xs text-[#8C7A6B]">
          Ao atingir o teto o bot para de chamar o provedor e gera um alerta crítico. Configure em
          Configurações IA.
        </p>
      </div>

      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-amber-950 mb-4">Por modelo (7 dias)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#8C7A6B]">
              <th className="pb-2">Modelo</th>
              <th className="pb-2 text-right">Chamadas</th>
              <th className="pb-2 text-right">Latência</th>
              <th className="pb-2 text-right">Custo</th>
            </tr>
          </thead>
          <tbody>
            {byModel.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-[#8C7A6B]">
                  Nenhuma chamada registrada ainda. O bot registra a partir do próximo atendimento.
                </td>
              </tr>
            )}
            {byModel.map((row) => (
              <tr key={row.model} className="border-t border-[#F5EFE6]">
                <td className="py-2.5 text-[#2E251B]">{row.model}</td>
                <td className="py-2.5 text-right">{row._count.id}</td>
                <td className="py-2.5 text-right">{Math.round(row._avg.latencyMs ?? 0)} ms</td>
                <td className="py-2.5 text-right">
                  {row._sum.costCents === null ? "n/d" : usd(row._sum.costCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
