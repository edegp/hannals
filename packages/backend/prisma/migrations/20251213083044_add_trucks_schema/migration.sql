/*
  Warnings:

  - You are about to drop the column `cargoAreaId` on the `PlacedItem` table. All the data in the column will be lost.
  - You are about to drop the `CargoArea` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `placementId` to the `PlacedItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PlacedItem" DROP CONSTRAINT "PlacedItem_cargoAreaId_fkey";

-- AlterTable
ALTER TABLE "PlacedItem" DROP COLUMN "cargoAreaId",
ADD COLUMN     "placementId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CargoArea";

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objFilePath" TEXT NOT NULL,
    "mtlFilePath" TEXT,
    "entranceDirection" TEXT NOT NULL DEFAULT 'back',
    "minX" DOUBLE PRECISION,
    "minY" DOUBLE PRECISION,
    "minZ" DOUBLE PRECISION,
    "maxX" DOUBLE PRECISION,
    "maxY" DOUBLE PRECISION,
    "maxZ" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "resultData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedItem" ADD CONSTRAINT "PlacedItem_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
