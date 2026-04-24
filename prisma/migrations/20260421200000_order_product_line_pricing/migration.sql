-- Per–order-line pricing (catalog product price/discount are defaults only)
ALTER TABLE "OrderProduct" ADD COLUMN "unitPrice" DECIMAL(12, 2);
ALTER TABLE "OrderProduct" ADD COLUMN "discountPercent" DECIMAL(5, 2);

UPDATE "OrderProduct" AS op
SET
  "unitPrice" = p.price,
  "discountPercent" = p.discount
FROM "Product" AS p
WHERE op."productId" = p.id AND op."unitPrice" IS NULL;
