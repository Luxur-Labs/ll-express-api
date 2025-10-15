-- CreateTable
CREATE TABLE "OrderProduct" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "workSpecification" TEXT NOT NULL,
    "shadeType" TEXT NOT NULL,
    "finishingInstructions" TEXT NOT NULL,
    "componentDetails" TEXT NOT NULL,
    "incaseOfAllAbutments" TEXT NOT NULL,
    "occlusalStaining" TEXT NOT NULL,
    "ponticDesign" TEXT NOT NULL,
    "repeatCorrections" TEXT NOT NULL,
    "enterReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderProduct_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
