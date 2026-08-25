-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "bot_settings" ADD COLUMN     "evolution_instance_name" TEXT,
ADD COLUMN     "evolution_instance_token" TEXT,
ALTER COLUMN "temperature" SET DEFAULT 0.2;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'ADMIN';
