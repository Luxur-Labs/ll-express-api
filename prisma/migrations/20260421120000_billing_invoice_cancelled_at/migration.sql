-- Remove duplicate invoices for the same clinic + billing period (keep newest row).
-- Required before a unique index on (clinicId, periodType, periodLabel) can be created.
DELETE FROM "BillingInvoice" invo
WHERE invo.id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY "clinicId", "periodType", "periodLabel"
        ORDER BY "createdAt" DESC, id DESC
      ) AS rn
    FROM "BillingInvoice"
  ) ranked
  WHERE ranked.rn > 1
);

-- Allow soft-cancelled invoices to free the clinic+period unique constraint
ALTER TABLE "BillingInvoice" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "BillingInvoice_clinic_period_unique";

CREATE UNIQUE INDEX "BillingInvoice_clinic_period_unique"
ON "BillingInvoice"("clinicId", "periodType", "periodLabel")
WHERE "cancelledAt" IS NULL;
