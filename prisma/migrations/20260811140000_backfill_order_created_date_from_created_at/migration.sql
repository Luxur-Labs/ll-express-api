-- Populate business createdDate from the existing row timestamp.
UPDATE "Order"
SET "createdDate" = "createdAt"
WHERE "createdDate" IS DISTINCT FROM "createdAt";
