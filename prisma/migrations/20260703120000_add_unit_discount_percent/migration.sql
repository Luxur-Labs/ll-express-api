-- Per-unit discount % on order lines (applied to each selected unit's rate).
ALTER TABLE "OrderProduct" ADD COLUMN "unitDiscountPercent" DECIMAL(5,2);
