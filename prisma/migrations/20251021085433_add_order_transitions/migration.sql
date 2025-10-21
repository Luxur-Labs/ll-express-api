-- CreateTable
CREATE TABLE "OrderTransition" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromState" "OrderStatus",
    "toState" "OrderStatus" NOT NULL,
    "transitionedBy" TEXT,
    "remarks" TEXT,
    "transitionOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderTransition_orderId_transitionOrder_key" ON "OrderTransition"("orderId", "transitionOrder");

-- AddForeignKey
ALTER TABLE "OrderTransition" ADD CONSTRAINT "OrderTransition_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
