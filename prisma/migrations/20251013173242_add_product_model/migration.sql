-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "warranty" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
