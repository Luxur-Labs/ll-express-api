-- AlterTable
ALTER TABLE "TechnicianGroup" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT;
