/*
  Warnings:

  - Added the required column `unitNumbers` to the `OrderProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderProduct" ADD COLUMN     "unitNumbers" TEXT NOT NULL DEFAULT '';
