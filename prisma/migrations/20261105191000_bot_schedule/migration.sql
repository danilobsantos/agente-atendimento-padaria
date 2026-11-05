-- AlterTable
ALTER TABLE "bot_settings" ADD COLUMN "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "weekly_schedule" JSONB,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
