-- Product-level notes on order lines
ALTER TABLE "OrderProduct" ADD COLUMN IF NOT EXISTS "notes" TEXT;
