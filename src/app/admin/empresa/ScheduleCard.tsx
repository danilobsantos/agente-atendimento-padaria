"use client";

import React, { useState } from "react";
import { Clock, Calendar, Copy, CheckCircle2, AlertCircle, Save } from "lucide-react";
import {
  normalizeWeeklySchedule,
  getBotScheduleStatus,
  DEFAULT_WEEKLY_SCHEDULE,
  DAY_NAMES_PT,
  type DaySchedule,
  type WeeklySchedule,
} from "@/lib/utils/bot-schedule";

interface ScheduleCardProps {
  initialBotSetting: {
    isActive?: boolean;
    scheduleEnabled?: boolean | null;
    weeklySchedule?: unknown;
    timezone?: string | null;
  } | null;
}

export default function ScheduleCard({ initialBotSetting }: ScheduleCardProps) {
  const [scheduleEnabled, setScheduleEnabled] = useState(
    Boolean(initialBotSetting?.scheduleEnabled)
  );
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(() =>
    normalizeWeeklySchedule(initialBotSetting?.weeklySchedule)
  );
  const [timezone] = useState(initialBotSetting?.timezone || "America/Sao_Paulo");
  const isActive = initialBotSetting?.isActive ?? true;

  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const updateDaySchedule = (dayIndex: number, patch: Partial<DaySchedule>) => {
    setWeeklySchedule((prev) =>
      prev.map((item) => (item.day === dayIndex ? { ...item, ...patch } : item))
    );
  };

  const applyBakeryPreset = () => {
    setWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d })));
  };

  const copyMondayToWeekdays = () => {
    const monday = weeklySchedule.find((d) => d.day === 1);
    if (!monday) return;
    setWeeklySchedule((prev) =>
      prev.map((item) => {
        if (item.day >= 2 && item.day <= 5) {
          return {
            ...item,
            enabled: monday.enabled,
            start: monday.start,
            end: monday.end,
          };
        }
        return item;
      })
    );
  };

  const schedulePreview = getBotScheduleStatus({
    isActive,
    scheduleEnabled,
    weeklySchedule,
    timezone,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/bot-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleEnabled,
          weeklySchedule,
          timezone,
        }),
      });

      if (res.ok) {
        setStatus({ type: "success", message: "Horários de atendimento salvos com sucesso!" });
      } else {
        const data = await res.json();
        setStatus({ type: "error", message: data.error || "Ocorreu um erro ao salvar os horários." });
      }
    } catch {
      setStatus({ type: "error", message: "Erro de conexão com o servidor." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-4xl">
      {status && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${status.type === "success"
            ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-800 border-rose-500/20"
            }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-700" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      <div className="bg-white border border-[#EBE2D5] rounded-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(46,37,27,0.02)]">
        <div className="flex items-center justify-between border-b border-[#FAF7F2] pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#EBE2D5]">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-amber-950">
                Programação de Horários de Atendimento
              </h2>
              <p className="text-xs text-[#6B5A4B] font-light">
                Configure os dias da semana e intervalos em que a IA deve responder. Fora do horário, ela permanece em silêncio.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setScheduleEnabled(!scheduleEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${scheduleEnabled ? "bg-amber-600" : "bg-[#EBE2D5]"
              }`}
            title={scheduleEnabled ? "Desativar programação de horário" : "Ativar programação de horário"}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${scheduleEnabled ? "translate-x-5" : "translate-x-0"
                }`}
            />
          </button>
        </div>

        {scheduleEnabled ? (
          <div className="space-y-5">
            {/* Live Status Preview */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${schedulePreview.inOperatingHours
                ? "bg-emerald-500/10 text-emerald-900 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-900 border-amber-500/20"
                }`}
            >
              <div className="flex items-center gap-2">
                {schedulePreview.inOperatingHours ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
                )}
                <span>
                  <strong>Status agora:</strong> {schedulePreview.statusLabel} ({schedulePreview.statusDetail})
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#6B5A4B] shrink-0">
                Horário local ({timezone}): <strong>{schedulePreview.currentLocalTime}</strong>
              </span>
            </div>

            {/* Quick Action Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-[#6B5A4B] uppercase tracking-wider mr-1">
                Atalhos rápidos:
              </span>
              <button
                type="button"
                onClick={applyBakeryPreset}
                className="text-xs bg-[#FAF7F2] hover:bg-[#F3EDE2] text-amber-900 border border-[#EBE2D5] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5 text-amber-700" />
                Padrão Padaria (Seg-Sex 08:00–19:30, Sáb 08:00–14:00, Dom Fechado)
              </button>
              <button
                type="button"
                onClick={copyMondayToWeekdays}
                className="text-xs bg-[#FAF7F2] hover:bg-[#F3EDE2] text-amber-900 border border-[#EBE2D5] px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5 text-amber-700" />
                Copiar Segunda p/ Ter-Sex
              </button>
            </div>

            {/* Daily Rows */}
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                const dayConfig = weeklySchedule.find((d) => d.day === dayIndex) || {
                  day: dayIndex,
                  enabled: false,
                  start: "08:00",
                  end: "19:30",
                };
                const isToday = schedulePreview.currentDay === dayIndex;

                return (
                  <div
                    key={dayIndex}
                    className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${dayConfig.enabled
                      ? isToday
                        ? "bg-amber-50/40 border-amber-300/80 shadow-xs"
                        : "bg-[#FAF7F2]/60 border-[#EBE2D5]"
                      : "bg-stone-50/80 border-[#EBE2D5]/60 opacity-70"
                      }`}
                  >
                    {/* Day name & toggle */}
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <input
                        type="checkbox"
                        id={`schedule-day-${dayIndex}`}
                        checked={dayConfig.enabled}
                        onChange={(e) => updateDaySchedule(dayIndex, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded accent-amber-700 cursor-pointer"
                      />
                      <label
                        htmlFor={`schedule-day-${dayIndex}`}
                        className={`text-sm font-semibold cursor-pointer select-none flex items-center gap-2 ${dayConfig.enabled ? "text-[#2E251B]" : "text-[#8C7A6B]"
                          }`}
                      >
                        {DAY_NAMES_PT[dayIndex]}
                        {isToday && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-600 text-white tracking-wide">
                            Hoje
                          </span>
                        )}
                      </label>
                    </div>

                    {/* Time Inputs or Closed text */}
                    {dayConfig.enabled ? (
                      <div className="flex items-center gap-2 text-sm text-[#6B5A4B]">
                        <span className="text-xs font-medium text-[#8C7A6B]">Das</span>
                        <input
                          type="time"
                          value={dayConfig.start}
                          onChange={(e) => updateDaySchedule(dayIndex, { start: e.target.value })}
                          className="bg-white border border-[#EBE2D5] text-[#2E251B] font-mono rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                        />
                        <span className="text-xs font-medium text-[#8C7A6B]">às</span>
                        <input
                          type="time"
                          value={dayConfig.end}
                          onChange={(e) => updateDaySchedule(dayIndex, { end: e.target.value })}
                          className="bg-white border border-[#EBE2D5] text-[#2E251B] font-mono rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-[#8C7A6B] italic font-medium sm:text-right">
                        Sem atendimento automático (Fechado)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-[#8C7A6B] leading-relaxed pt-1">
              💡 <strong>Como funciona fora do horário:</strong> A IA não enviará mensagens e não gerará pedidos automáticos. As mensagens enviadas pelos clientes continuarão sendo salvas no histórico e exibidas no painel de atendimento humano em tempo real.
            </p>
          </div>
        ) : (
          <div className="bg-[#FAF7F2] border border-[#EBE2D5] rounded-xl p-4 text-xs text-[#6B5A4B] leading-relaxed">
            A programação de horário está <strong>desativada</strong>. A IA responderá 24 horas por dia, 7 dias por semana, enquanto a chave geral estiver ativa. Ative o botão no canto superior para programar horários de início e fim por dia da semana.
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#FAF7F2]">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95 text-sm"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvando..." : "Salvar Horários"}
          </button>
        </div>
      </div>
    </form>
  );
}

