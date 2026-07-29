-- Clinic portal login (WhatsApp OTP) + OTP storage
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLINIC';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clinicId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_clinicId_key" ON "User"("clinicId");
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OtpChallenge" (
  "id" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "clinicId" TEXT,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OtpChallenge_phoneE164_purpose_createdAt_idx"
  ON "OtpChallenge"("phoneE164", "purpose", "createdAt");
