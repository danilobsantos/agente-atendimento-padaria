-- AlterTable
ALTER TABLE "bot_settings" ADD COLUMN     "max_output_tokens" INTEGER NOT NULL DEFAULT 4096,
ADD COLUMN     "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7;
