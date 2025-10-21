/*
  Warnings:

  - The values [NEW,IN_PROGRESS,COMPLETED,CANCELLED,ON_HOLD] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('ORDER_INITIATED', 'TASK_ASSIGNMENT', 'TASK_COMPLETION', 'TASK_APPROVED', 'TASK_REJECTED', 'READY_FOR_DISPATCH', 'DISPATCH_INITIATED', 'DISPATCH_PARTNER_BOOKED', 'ORDER_SHIPPED', 'ORDER_DELIVERED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TABLE "OrderTransition" ALTER COLUMN "fromState" TYPE "OrderStatus_new" USING ("fromState"::text::"OrderStatus_new");
ALTER TABLE "OrderTransition" ALTER COLUMN "toState" TYPE "OrderStatus_new" USING ("toState"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'ORDER_INITIATED';
COMMIT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'ORDER_INITIATED';
