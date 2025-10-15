/*
  Warnings:

  - A unique constraint covering the columns `[leaderId]` on the table `TechnicianGroup` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TechnicianGroup" ADD COLUMN     "leaderId" TEXT;

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientAddress" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianGroup_leaderId_key" ON "TechnicianGroup"("leaderId");

-- AddForeignKey
ALTER TABLE "TechnicianGroup" ADD CONSTRAINT "TechnicianGroup_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
