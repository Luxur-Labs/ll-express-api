-- Billing: clinic balance, tax invoices, lines, ledger

CREATE TYPE "BillingPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY');
CREATE TYPE "BillingLedgerEntryType" AS ENUM ('INVOICE', 'PAYMENT', 'CREDIT_ADJUSTMENT', 'MANUAL');

ALTER TABLE "Clinic" ADD COLUMN "pendingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "periodType" "BillingPeriodType" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roundOff" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "invoiceSubtotal" DECIMAL(12,2) NOT NULL,
    "previousBalance" DECIMAL(12,2) NOT NULL,
    "totalPayable" DECIMAL(12,2) NOT NULL,
    "receivedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditsAdjusted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "totalInWords" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingInvoice_invoiceNumber_key" ON "BillingInvoice"("invoiceNumber");
CREATE INDEX "BillingInvoice_clinicId_idx" ON "BillingInvoice"("clinicId");

ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderProductId" TEXT,
    "voucherNo" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "patientName" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "toothNo" TEXT,
    "unit" INTEGER NOT NULL DEFAULT 1,
    "ratePerUnit" DECIMAL(12,2) NOT NULL,
    "discountRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingInvoiceLine_invoiceId_idx" ON "BillingInvoiceLine"("invoiceId");

ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingLedgerEntry" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "entryType" "BillingLedgerEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingLedgerEntry_clinicId_idx" ON "BillingLedgerEntry"("clinicId");
CREATE INDEX "BillingLedgerEntry_invoiceId_idx" ON "BillingLedgerEntry"("invoiceId");

ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingLedgerEntry" ADD CONSTRAINT "BillingLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
