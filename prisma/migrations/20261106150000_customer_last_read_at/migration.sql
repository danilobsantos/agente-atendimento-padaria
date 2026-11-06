-- AlterTable
ALTER TABLE "customers" ADD COLUMN "last_read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "customers_tenant_id_last_read_at_idx" ON "customers"("tenant_id", "last_read_at");

