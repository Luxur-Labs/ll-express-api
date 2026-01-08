-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_doctorId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "doctorName" TEXT,
ADD COLUMN     "referenceName" TEXT,
ALTER COLUMN "doctorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
