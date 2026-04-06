/*
  Warnings:

  - The primary key for the `inventory_movements` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `material_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `materials` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `zone_id` column on the `materials` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `password_reset_tokens` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `warehouse_config` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `warehouse_zones` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[company_id,sku]` on the table `materials` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `id` on the `inventory_movements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `material_id` on the `inventory_movements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `created_by` on the `inventory_movements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `material_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `materials` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `category_id` on the `materials` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `password_reset_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `password_reset_tokens` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `warehouse_config` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `warehouse_zones` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `config_id` on the `warehouse_zones` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('caja_seca', 'refrigerado', 'plataforma', 'volteo', 'pipa', 'otro');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('disponible', 'en_viaje', 'mantenimiento', 'inactivo');

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_created_by_fkey";

-- DropForeignKey
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_material_id_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_category_id_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_zone_id_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_zones" DROP CONSTRAINT "warehouse_zones_config_id_fkey";

-- DropIndex
DROP INDEX "inventory_movements_company_id_idx";

-- DropIndex
DROP INDEX "material_categories_company_id_idx";

-- DropIndex
DROP INDEX "material_categories_name_key";

-- DropIndex
DROP INDEX "materials_company_id_idx";

-- DropIndex
DROP INDEX "materials_sku_key";

-- DropIndex
DROP INDEX "users_company_id_idx";

-- DropIndex
DROP INDEX "warehouse_config_company_id_idx";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "material_id",
ADD COLUMN     "material_id" UUID NOT NULL,
DROP COLUMN "created_by",
ADD COLUMN     "created_by" UUID NOT NULL,
ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "material_categories" DROP CONSTRAINT "material_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "materials" DROP CONSTRAINT "materials_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "category_id",
ADD COLUMN     "category_id" UUID NOT NULL,
DROP COLUMN "zone_id",
ADD COLUMN     "zone_id" UUID,
ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "warehouse_config" DROP CONSTRAINT "warehouse_config_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "warehouse_config_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "warehouse_zones" DROP CONSTRAINT "warehouse_zones_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "config_id",
ADD COLUMN     "config_id" UUID NOT NULL,
ADD CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "type" "UnitType" NOT NULL,
    "axles" INTEGER NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'disponible',
    "vin" TEXT,
    "insurance_expiry" TIMESTAMP(3),
    "fuel_efficiency_km_l" DECIMAL(10,2),
    "last_maintenance_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "replaced_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_company_id_plate_key" ON "units"("company_id", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "units_company_id_vin_key" ON "units"("company_id", "vin");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
DROP INDEX IF EXISTS "materials_company_id_sku_key";
CREATE UNIQUE INDEX "materials_company_id_sku_key" ON "materials"("company_id", "sku");


-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "warehouse_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
