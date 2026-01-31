-- Add soft-delete flag to clinics
ALTER TABLE "Clinic"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT TRUE;
