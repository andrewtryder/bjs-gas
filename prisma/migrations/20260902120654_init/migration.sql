-- CreateTable
CREATE TABLE "Club" (
    "clubNumber" INTEGER NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "hasGas" BOOLEAN NOT NULL,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clubUrl" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("clubNumber")
);

-- CreateTable
CREATE TABLE "FuelPriceCurrent" (
    "clubNumber" INTEGER NOT NULL,
    "fuelSku" TEXT NOT NULL,
    "fuelName" TEXT NOT NULL,
    "price" DECIMAL(6,3) NOT NULL,
    "sourcePriceAtLocal" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelPriceCurrent_pkey" PRIMARY KEY ("clubNumber","fuelSku")
);

-- CreateTable
CREATE TABLE "FuelPriceHistory" (
    "id" BIGSERIAL NOT NULL,
    "clubNumber" INTEGER NOT NULL,
    "fuelSku" TEXT NOT NULL,
    "fuelName" TEXT NOT NULL,
    "price" DECIMAL(6,3) NOT NULL,
    "sourcePriceAtLocal" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_clubId_key" ON "Club"("clubId");

-- CreateIndex
CREATE INDEX "FuelPriceCurrent_observedAt_idx" ON "FuelPriceCurrent"("observedAt");

-- CreateIndex
CREATE INDEX "FuelPriceHistory_clubNumber_observedAt_idx" ON "FuelPriceHistory"("clubNumber", "observedAt");

-- CreateIndex
CREATE INDEX "FuelPriceHistory_clubNumber_fuelSku_observedAt_idx" ON "FuelPriceHistory"("clubNumber", "fuelSku", "observedAt");

-- CreateIndex
CREATE INDEX "FuelPriceHistory_observedAt_idx" ON "FuelPriceHistory"("observedAt");

-- AddForeignKey
ALTER TABLE "FuelPriceCurrent" ADD CONSTRAINT "FuelPriceCurrent_clubNumber_fkey" FOREIGN KEY ("clubNumber") REFERENCES "Club"("clubNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPriceHistory" ADD CONSTRAINT "FuelPriceHistory_clubNumber_fkey" FOREIGN KEY ("clubNumber") REFERENCES "Club"("clubNumber") ON DELETE CASCADE ON UPDATE CASCADE;
