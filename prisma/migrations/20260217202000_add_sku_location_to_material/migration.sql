-- AlterTable
ALTER TABLE "materials" ADD COLUMN "sku" TEXT,
                        ADD COLUMN "location" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "materials_sku_key" ON "materials"("sku");
