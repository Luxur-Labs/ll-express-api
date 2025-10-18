/*
  Warnings:

  - You are about to drop the column `workType` on the `Product` table. All the data in the column will be lost.
  - Added the required column `workType` to the `OrderProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderProduct" ADD COLUMN     "workType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "workType";
