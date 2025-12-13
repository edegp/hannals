-- AlterTable
ALTER TABLE "PlacedItem" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "isDelivered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLoaded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loadOrder" INTEGER,
ADD COLUMN     "loadedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT;
