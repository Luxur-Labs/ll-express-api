/*
  Warnings:

  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `fromState` column on the `OrderTransition` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `toState` on the `OrderTransition` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/

-- Add applicationStatus column to Order table
ALTER TABLE "Order" ADD COLUMN "applicationStatus" TEXT NOT NULL DEFAULT 'NEW';

-- Update existing orders to have NEW as application status
UPDATE "Order" SET "applicationStatus" = 'NEW' WHERE "applicationStatus" IS NULL;

-- Convert status column from enum to text
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'ORDER_INITIATED';

-- Convert OrderTransition columns from enum to text
ALTER TABLE "OrderTransition" ALTER COLUMN "fromState" TYPE TEXT USING "fromState"::TEXT;
ALTER TABLE "OrderTransition" ALTER COLUMN "toState" TYPE TEXT USING "toState"::TEXT;

-- Drop the enum type with CASCADE to handle dependencies
DROP TYPE "public"."OrderStatus" CASCADE;
