-- Superseded by migration 20260421120000_billing_invoice_cancelled_at, which adds
-- `cancelledAt` and a partial unique index on (clinicId, periodType, periodLabel).
-- The original CREATE UNIQUE INDEX failed when duplicate period rows already existed.
-- Dedupe for that case runs at the start of 20260421120000.
SELECT 1;
