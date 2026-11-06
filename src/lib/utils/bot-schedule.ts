/**
 * Utilitário de Programação de Horários de Atendimento do Bot.
 * Suporta fuso horário (padrão America/Sao_Paulo), horários reduzidos em fins de semana
 * e verificação precisa de dias ativos e intervalo de atendimento.
 */

export interface DaySchedule {
  day: number; // 0 = Domingo, 1 = Segunda-feira, ..., 6 = Sábado
  enabled: boolean;
  start: string; // "HH:mm" (ex: "08:00")
  end: string;   // "HH:mm" (ex: "19:30")
}

export type WeeklySchedule = DaySchedule[];

export const DAY_NAMES_PT = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const DAY_NAMES_SHORT_PT = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = [
  { day: 0, enabled: false, start: "08:00", end: "12:00" }, // Domingo
  { day: 1, enabled: true, start: "08:00", end: "19:30" }, // Segunda
  { day: 2, enabled: true, start: "08:00", end: "19:30" }, // Terça
  { day: 3, enabled: true, start: "08:00", end: "19:30" }, // Quarta
  { day: 4, enabled: true, start: "08:00", end: "19:30" }, // Quinta
  { day: 5, enabled: true, start: "08:00", end: "19:30" }, // Sexta
  { day: 6, enabled: true, start: "08:00", end: "14:00" }, // Sábado
];

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Normaliza qualquer dado recebido para garantir uma lista consistente de 7 dias (0 a 6).
 */
export function normalizeWeeklySchedule(raw: unknown): WeeklySchedule {
  const result: WeeklySchedule = [];
  const rawList = Array.isArray(raw) ? raw : [];
  const mapByDay = new Map<number, DaySchedule>();

  for (const item of rawList) {
    if (item && typeof item === "object" && typeof item.day === "number") {
      const day = item.day;
      if (day >= 0 && day <= 6) {
        mapByDay.set(day, {
          day,
          enabled: Boolean(item.enabled),
          start: typeof item.start === "string" && /^\d{2}:\d{2}$/.test(item.start) ? item.start : "08:00",
          end: typeof item.end === "string" && /^\d{2}:\d{2}$/.test(item.end) ? item.end : "19:30",
        });
      }
    }
  }

  for (let d = 0; d <= 6; d++) {
    const existing = mapByDay.get(d);
    if (existing) {
      result.push(existing);
    } else {
      const def = DEFAULT_WEEKLY_SCHEDULE.find((x) => x.day === d)!;
      result.push({ ...def });
    }
  }

  return result.sort((a, b) => a.day - b.day);
}

/**
 * Retorna as informações de dia da semana (0-6) e horário (HH:mm) convertidos para o fuso horário alvo.
 */
export function getZonedTimeInfo(
  date: Date = new Date(),
  timezone = "America/Sao_Paulo"
): { dayOfWeek: number; timeString: string; dayName: string } {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const dayOfWeek = WEEKDAY_MAP[weekdayShort] ?? 0;

    const rawHour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const hour = rawHour === "24" ? "00" : rawHour.padStart(2, "0");
    const minute = (parts.find((p) => p.type === "minute")?.value ?? "00").padStart(2, "0");

    return {
      dayOfWeek,
      timeString: `${hour}:${minute}`,
      dayName: DAY_NAMES_PT[dayOfWeek],
    };
  } catch (err) {
    console.error(`[bot-schedule] Invalid timezone ${timezone}, falling back to UTC:`, err);
    return {
      dayOfWeek: date.getUTCDay(),
      timeString: `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`,
      dayName: DAY_NAMES_PT[date.getUTCDay()],
    };
  }
}

export interface BotScheduleEvaluation {
  inOperatingHours: boolean;
  reason:
  | "bot_inactive"
  | "schedule_disabled"
  | "within_schedule"
  | "day_disabled"
  | "outside_hours";
  currentTime: string;
  currentDay: number;
  currentDayName: string;
  todayConfig?: DaySchedule;
  timezone: string;
}

export interface BotSettingLike {
  isActive?: boolean;
  scheduleEnabled?: boolean | null;
  weeklySchedule?: unknown;
  timezone?: string | null;
}

/**
 * Avalia se o bot deve responder neste exato momento de acordo com as configurações do tenant.
 */
export function checkBotOperatingSchedule(
  setting: BotSettingLike,
  now: Date = new Date()
): BotScheduleEvaluation {
  const timezone = setting.timezone?.trim() || "America/Sao_Paulo";
  const { dayOfWeek, timeString, dayName } = getZonedTimeInfo(now, timezone);

  // 1. Chave mestre desligada
  if (setting.isActive === false) {
    return {
      inOperatingHours: false,
      reason: "bot_inactive",
      currentTime: timeString,
      currentDay: dayOfWeek,
      currentDayName: dayName,
      timezone,
    };
  }

  // 2. Programação de horário desabilitada -> Ativo 24/7
  if (!setting.scheduleEnabled) {
    return {
      inOperatingHours: true,
      reason: "schedule_disabled",
      currentTime: timeString,
      currentDay: dayOfWeek,
      currentDayName: dayName,
      timezone,
    };
  }

  // 3. Programação ativada: verifica o dia e horário
  const schedule = normalizeWeeklySchedule(setting.weeklySchedule);
  const todayConfig = schedule.find((s) => s.day === dayOfWeek);

  if (!todayConfig || !todayConfig.enabled) {
    return {
      inOperatingHours: false,
      reason: "day_disabled",
      currentTime: timeString,
      currentDay: dayOfWeek,
      currentDayName: dayName,
      todayConfig,
      timezone,
    };
  }

  const { start, end } = todayConfig;

  let inInterval = false;
  if (start <= end) {
    // Exemplo: 08:00 até 19:30
    inInterval = timeString >= start && timeString <= end;
  } else {
    // Exemplo (caso cruze meia-noite): 18:00 até 02:00
    inInterval = timeString >= start || timeString <= end;
  }

  if (inInterval) {
    return {
      inOperatingHours: true,
      reason: "within_schedule",
      currentTime: timeString,
      currentDay: dayOfWeek,
      currentDayName: dayName,
      todayConfig,
      timezone,
    };
  }

  return {
    inOperatingHours: false,
    reason: "outside_hours",
    currentTime: timeString,
    currentDay: dayOfWeek,
    currentDayName: dayName,
    todayConfig,
    timezone,
  };
}

export interface BotScheduleStatusSummary {
  isActive: boolean;
  scheduleEnabled: boolean;
  inOperatingHours: boolean;
  statusLabel: "Ativo 24h" | "No Horário" | "Fora do Horário" | "Pausado";
  statusDetail: string;
  currentLocalTime: string;
  currentDay: number;
  todaySchedule?: DaySchedule;
  weeklySchedule: WeeklySchedule;
}

/**
 * Retorna um resumo legível e formatado para ser consumido pelo painel e APIs.
 */
export function getBotScheduleStatus(
  setting: BotSettingLike,
  now: Date = new Date()
): BotScheduleStatusSummary {
  const evalResult = checkBotOperatingSchedule(setting, now);
  const weeklySchedule = normalizeWeeklySchedule(setting.weeklySchedule);
  const isActive = setting.isActive !== false;
  const scheduleEnabled = Boolean(setting.scheduleEnabled);

  if (!isActive) {
    return {
      isActive: false,
      scheduleEnabled,
      inOperatingHours: false,
      statusLabel: "Pausado",
      statusDetail: "IA desligada manualmente na chave geral",
      currentLocalTime: evalResult.currentTime,
      currentDay: evalResult.currentDay,
      todaySchedule: evalResult.todayConfig,
      weeklySchedule,
    };
  }

  if (!scheduleEnabled) {
    return {
      isActive: true,
      scheduleEnabled: false,
      inOperatingHours: true,
      statusLabel: "Ativo 24h",
      statusDetail: "Atendimento automático ininterrupto",
      currentLocalTime: evalResult.currentTime,
      currentDay: evalResult.currentDay,
      todaySchedule: evalResult.todayConfig,
      weeklySchedule,
    };
  }

  if (evalResult.inOperatingHours) {
    const today = evalResult.todayConfig;
    const detail = today ? `Hoje: das ${today.start} às ${today.end}` : "Dentro do horário programado";
    return {
      isActive: true,
      scheduleEnabled: true,
      inOperatingHours: true,
      statusLabel: "No Horário",
      statusDetail: detail,
      currentLocalTime: evalResult.currentTime,
      currentDay: evalResult.currentDay,
      todaySchedule: today,
      weeklySchedule,
    };
  }

  // Fora do horário programado
  const today = evalResult.todayConfig;
  let detail = "Fora do expediente programado";
  if (!today || !today.enabled) {
    detail = `Fechado aos ${DAY_NAMES_PT[evalResult.currentDay].toLowerCase()}s`;
  } else if (evalResult.currentTime < today.start) {
    detail = `Abre hoje às ${today.start}`;
  } else {
    detail = `Encerrou hoje às ${today.end}`;
  }

  return {
    isActive: true,
    scheduleEnabled: true,
    inOperatingHours: false,
    statusLabel: "Fora do Horário",
    statusDetail: detail,
    currentLocalTime: evalResult.currentTime,
    currentDay: evalResult.currentDay,
    todaySchedule: today,
    weeklySchedule,
  };
}
