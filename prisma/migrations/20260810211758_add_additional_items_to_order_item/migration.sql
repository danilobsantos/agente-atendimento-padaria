-- DropIndex
DROP INDEX "additional_items_category_id_idx";

-- DropIndex
DROP INDEX "additional_items_tenant_id_idx";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "additional_items" JSONB;
