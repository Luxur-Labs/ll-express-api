-- Business order date, independent of the row's createdAt timestamp.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "createdDate" TIMESTAMP(3);

UPDATE "Order"
SET "createdDate" = "createdAt"
WHERE "createdDate" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "createdDate" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Order_createdDate_idx" ON "Order"("createdDate");
