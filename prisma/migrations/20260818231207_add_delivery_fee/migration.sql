-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivery_fee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "delivery_fee" DOUBLE PRECISION NOT NULL DEFAULT 0;
