-- CreateTable
CREATE TABLE "OrderImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT,
    "importedByEmail" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "ordersAttempted" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderImportBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "patientName" TEXT,
    "clinicName" TEXT,
    "productCount" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderImportBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderImportBatchItem_batchId_idx" ON "OrderImportBatchItem"("batchId");

-- CreateIndex
CREATE INDEX "OrderImportBatchItem_orderId_idx" ON "OrderImportBatchItem"("orderId");

-- AddForeignKey
ALTER TABLE "OrderImportBatchItem" ADD CONSTRAINT "OrderImportBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OrderImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
