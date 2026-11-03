-- AlterTable
ALTER TABLE "bot_settings" ADD COLUMN     "monthly_budget_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "bot_silenced_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "llm_calls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'agent_turn',
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warn',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "ref_kind" TEXT,
    "ref_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT DEFAULT 'Geral',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_calls_tenant_id_created_at_idx" ON "llm_calls"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_calls_tenant_id_status_created_at_idx" ON "llm_calls"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "alerts_tenant_id_status_created_at_idx" ON "alerts"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "alerts_tenant_id_kind_ref_kind_ref_id_idx" ON "alerts"("tenant_id", "kind", "ref_kind", "ref_id");

-- CreateIndex
CREATE INDEX "knowledge_entries_tenant_id_is_active_idx" ON "knowledge_entries"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
