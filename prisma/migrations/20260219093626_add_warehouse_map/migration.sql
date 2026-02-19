-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "zone_id" TEXT;

-- CreateTable
CREATE TABLE "warehouse_config" (
    "id" TEXT NOT NULL,
    "width_m" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "height_m" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "x_pct" DOUBLE PRECISION NOT NULL,
    "y_pct" DOUBLE PRECISION NOT NULL,
    "w_pct" DOUBLE PRECISION NOT NULL,
    "h_pct" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4CAF50',
    "config_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "warehouse_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
