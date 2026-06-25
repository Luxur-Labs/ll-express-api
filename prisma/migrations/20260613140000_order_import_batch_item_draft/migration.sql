-- AlterTable
ALTER TABLE "OrderImportBatchItem" ADD COLUMN IF NOT EXISTS "draftJson" JSONB;
