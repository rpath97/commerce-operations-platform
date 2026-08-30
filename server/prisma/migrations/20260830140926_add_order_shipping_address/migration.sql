-- CreateTable
CREATE TABLE "public"."OrderShippingAddress" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "suburb" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT,

    CONSTRAINT "OrderShippingAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderShippingAddress_orderId_key" ON "public"."OrderShippingAddress"("orderId");

-- AddForeignKey
ALTER TABLE "public"."OrderShippingAddress" ADD CONSTRAINT "OrderShippingAddress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
