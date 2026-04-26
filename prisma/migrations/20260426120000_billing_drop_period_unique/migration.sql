-- Allow multiple non-cancelled invoices for the same clinic + period (e.g. follow-up
-- invoices when new order lines are added in the same month). Unbilled line detection
-- is enforced in application code via BillingInvoiceLine (orderId + orderProductId).
-- The previous partial unique index blocked a second invoice for Apr-2026, etc.
DROP INDEX IF EXISTS "BillingInvoice_clinic_period_unique";
