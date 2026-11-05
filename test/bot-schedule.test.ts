import test from "node:test";
import assert from "node:assert/strict";
import {
  checkBotOperatingSchedule,
  getBotScheduleStatus,
  normalizeWeeklySchedule,
  DEFAULT_WEEKLY_SCHEDULE,
  WeeklySchedule,
} from "../src/lib/utils/bot-schedule";

test("bot-schedule: normalizeWeeklySchedule garante 7 dias completos com defaults", () => {
  const empty = normalizeWeeklySchedule(null);
  assert.equal(empty.length, 7);
  assert.equal(empty[0].day, 0); // Domingo
  assert.equal(empty[0].enabled, false);
  assert.equal(empty[1].day, 1); // Segunda
  assert.equal(empty[1].enabled, true);
  assert.equal(empty[1].start, "08:00");
  assert.equal(empty[1].end, "19:30");
  assert.equal(empty[6].day, 6); // Sábado
  assert.equal(empty[6].enabled, true);
  assert.equal(empty[6].start, "08:00");
  assert.equal(empty[6].end, "14:00");
});

test("bot-schedule: chave mestre isActive=false sempre bloqueia o atendimento", () => {
  const res = checkBotOperatingSchedule({
    isActive: false,
    scheduleEnabled: true,
  });
  assert.equal(res.inOperatingHours, false);
  assert.equal(res.reason, "bot_inactive");
});

test("bot-schedule: scheduleEnabled=false mantém o bot ativo 24/7", () => {
  // Quinta-feira de madrugada: 03:00 em São Paulo (06:00 UTC)
  const dateMadrugada = new Date("2026-11-05T06:00:00Z");
  const res = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: false,
    },
    dateMadrugada
  );
  assert.equal(res.inOperatingHours, true);
  assert.equal(res.reason, "schedule_disabled");
});

test("bot-schedule: dentro do horário em dia útil (Quinta-feira 14:30 em SP)", () => {
  // 17:30 UTC = 14:30 em America/Sao_Paulo (UTC-3)
  const dateUtil = new Date("2026-11-05T17:30:00Z");
  const res = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateUtil
  );
  assert.equal(res.inOperatingHours, true);
  assert.equal(res.reason, "within_schedule");
  assert.equal(res.currentDay, 4); // Quinta
  assert.equal(res.currentTime, "14:30");
});

test("bot-schedule: fora do horário em dia útil após 19:30 (Quinta-feira 20:00 em SP)", () => {
  // 23:00 UTC = 20:00 em America/Sao_Paulo
  const dateNoite = new Date("2026-11-05T23:00:00Z");
  const res = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateNoite
  );
  assert.equal(res.inOperatingHours, false);
  assert.equal(res.reason, "outside_hours");
  assert.equal(res.currentTime, "20:00");
});

test("bot-schedule: dia desabilitado (Domingo)", () => {
  // 2026-11-08 é Domingo. 15:00 UTC = 12:00 SP
  const dateDomingo = new Date("2026-11-08T15:00:00Z");
  const res = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateDomingo
  );
  assert.equal(res.inOperatingHours, false);
  assert.equal(res.reason, "day_disabled");
  assert.equal(res.currentDay, 0); // Domingo
});

test("bot-schedule: horário reduzido no Sábado (08:00 às 14:00)", () => {
  // 2026-11-07 é Sábado.
  // 14:00 UTC = 11:00 SP -> Dentro do horário (08:00 às 14:00)
  const dateSabadoDentro = new Date("2026-11-07T14:00:00Z");
  const resDentro = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateSabadoDentro
  );
  assert.equal(resDentro.inOperatingHours, true);
  assert.equal(resDentro.currentDay, 6); // Sábado
  assert.equal(resDentro.currentTime, "11:00");

  // 18:00 UTC = 15:00 SP -> Fora do horário (encerrou às 14:00)
  const dateSabadoFora = new Date("2026-11-07T18:00:00Z");
  const resFora = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateSabadoFora
  );
  assert.equal(resFora.inOperatingHours, false);
  assert.equal(resFora.reason, "outside_hours");
});

test("bot-schedule: limites exatos (08:00 e 19:30 são inclusivos, 19:31 fecha)", () => {
  // 11:00 UTC = 08:00 SP
  const dateAbertura = new Date("2026-11-05T11:00:00Z");
  const resAbertura = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateAbertura
  );
  assert.equal(resAbertura.inOperatingHours, true);
  assert.equal(resAbertura.currentTime, "08:00");

  // 22:30 UTC = 19:30 SP
  const dateFechamento = new Date("2026-11-05T22:30:00Z");
  const resFechamento = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateFechamento
  );
  assert.equal(resFechamento.inOperatingHours, true);
  assert.equal(resFechamento.currentTime, "19:30");

  // 22:31 UTC = 19:31 SP
  const datePosFechamento = new Date("2026-11-05T22:31:00Z");
  const resPosFechamento = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    datePosFechamento
  );
  assert.equal(resPosFechamento.inOperatingHours, false);
  assert.equal(resPosFechamento.currentTime, "19:31");
});

test("bot-schedule: getBotScheduleStatus gera resumo correto para a interface", () => {
  const dateUtil = new Date("2026-11-05T17:30:00Z"); // Quinta 14:30
  const status = getBotScheduleStatus(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateUtil
  );
  assert.equal(status.statusLabel, "No Horário");
  assert.equal(status.inOperatingHours, true);
  assert.match(status.statusDetail, /Hoje: das 08:00 às 19:30/);

  const statusPausado = getBotScheduleStatus(
    {
      isActive: false,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
    },
    dateUtil
  );
  assert.equal(statusPausado.statusLabel, "Pausado");
  assert.equal(statusPausado.inOperatingHours, false);
});

test("bot-schedule: antes da abertura gera mensagem 'Abre hoje às HH:mm'", () => {
  // 10:00 UTC = 07:00 SP (Quinta-feira antes das 08:00)
  const dateAntes = new Date("2026-11-05T10:00:00Z");
  const status = getBotScheduleStatus(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateAntes
  );
  assert.equal(status.statusLabel, "Fora do Horário");
  assert.equal(status.inOperatingHours, false);
  assert.match(status.statusDetail, /Abre hoje às 08:00/);
});

test("bot-schedule: após o fechamento gera mensagem 'Encerrou hoje às HH:mm'", () => {
  // 23:30 UTC = 20:30 SP (Quinta-feira depois das 19:30)
  const dateDepois = new Date("2026-11-05T23:30:00Z");
  const status = getBotScheduleStatus(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
      timezone: "America/Sao_Paulo",
    },
    dateDepois
  );
  assert.equal(status.statusLabel, "Fora do Horário");
  assert.equal(status.inOperatingHours, false);
  assert.match(status.statusDetail, /Encerrou hoje às 19:30/);
});

test("bot-schedule: suporta configuração personalizada com domingo aberto em meio período", () => {
  const customSchedule = [
    { day: 0, enabled: true, start: "08:00", end: "12:00" }, // Domingo aberto até meio-dia
    { day: 1, enabled: true, start: "07:30", end: "20:00" },
    { day: 2, enabled: true, start: "07:30", end: "20:00" },
    { day: 3, enabled: true, start: "07:30", end: "20:00" },
    { day: 4, enabled: true, start: "07:30", end: "20:00" },
    { day: 5, enabled: true, start: "07:30", end: "20:00" },
    { day: 6, enabled: true, start: "08:00", end: "16:00" },
  ];

  // 2026-11-08 é Domingo. 14:00 UTC = 11:00 SP (dentro das 08:00 às 12:00)
  const dateDomingoDentro = new Date("2026-11-08T14:00:00Z");
  const resDomingoDentro = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: customSchedule,
      timezone: "America/Sao_Paulo",
    },
    dateDomingoDentro
  );
  assert.equal(resDomingoDentro.inOperatingHours, true);
  assert.equal(resDomingoDentro.currentDay, 0);
  assert.equal(resDomingoDentro.currentTime, "11:00");

  // 16:00 UTC = 13:00 SP (fechado após 12:00)
  const dateDomingoFora = new Date("2026-11-08T16:00:00Z");
  const resDomingoFora = checkBotOperatingSchedule(
    {
      isActive: true,
      scheduleEnabled: true,
      weeklySchedule: customSchedule,
      timezone: "America/Sao_Paulo",
    },
    dateDomingoFora
  );
  assert.equal(resDomingoFora.inOperatingHours, false);
  assert.equal(resDomingoFora.reason, "outside_hours");
});

