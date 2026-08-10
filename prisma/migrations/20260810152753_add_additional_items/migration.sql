-- CreateTable
CREATE TABLE "additional_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "additional_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "additional_items_tenant_id_idx" ON "additional_items"("tenant_id");

-- CreateIndex
CREATE INDEX "additional_items_category_id_idx" ON "additional_items"("category_id");

-- AddForeignKey
ALTER TABLE "additional_items" ADD CONSTRAINT "additional_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_items" ADD CONSTRAINT "additional_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
