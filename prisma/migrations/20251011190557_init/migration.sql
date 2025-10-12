-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'DOCTOR', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "employeeTypeId" TEXT,
    "technicianGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "EmployeeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TechnicianGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeType_name_key" ON "EmployeeType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianGroup_name_key" ON "TechnicianGroup"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeTypeId_fkey" FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_technicianGroupId_fkey" FOREIGN KEY ("technicianGroupId") REFERENCES "TechnicianGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
