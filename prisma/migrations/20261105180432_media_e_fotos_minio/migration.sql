-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "media_key" TEXT,
ADD COLUMN     "media_type" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "photo_url" TEXT;
