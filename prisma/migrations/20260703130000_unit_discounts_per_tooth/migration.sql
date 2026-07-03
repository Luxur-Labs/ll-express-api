-- Per-tooth discount map (JSON: {"24": 10, "32": 5} = % per FDI tooth).
ALTER TABLE "OrderProduct" DROP COLUMN IF EXISTS "unitDiscountPercent";
ALTER TABLE "OrderProduct" ADD COLUMN "unitDiscounts" JSONB;
