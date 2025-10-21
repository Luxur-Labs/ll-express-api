-- CreateTable
CREATE TABLE "OrderTechnicianGroup" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "technicianGroupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTechnicianGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderTechnicianGroup_orderId_technicianGroupId_key" ON "OrderTechnicianGroup"("orderId", "technicianGroupId");

-- AddForeignKey
ALTER TABLE "OrderTechnicianGroup" ADD CONSTRAINT "OrderTechnicianGroup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTechnicianGroup" ADD CONSTRAINT "OrderTechnicianGroup_technicianGroupId_fkey" FOREIGN KEY ("technicianGroupId") REFERENCES "TechnicianGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
