-- Migration: Add multitenancy support
-- Adds companies table and company_id foreign key to all tenant-scoped tables.
-- Existing data is assigned to the default "demo" company.

-- ============================================================
-- 1. Create companies table
-- ============================================================
CREATE TABLE "companies" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"       TEXT         NOT NULL,
  "slug"       TEXT         NOT NULL,
  "active"     BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- ============================================================
-- 2. Insert default demo company
-- ============================================================
INSERT INTO "companies" ("id", "name", "slug")
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'demo');

-- ============================================================
-- 3. Add company_id to users
-- ============================================================
ALTER TABLE "users" ADD COLUMN "company_id" UUID;
UPDATE "users" SET "company_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "users" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- ============================================================
-- 4. Add company_id to material_categories
-- ============================================================
ALTER TABLE "material_categories" ADD COLUMN "company_id" UUID;
UPDATE "material_categories" SET "company_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "material_categories" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "material_categories" ADD CONSTRAINT "material_categories_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Replace global name unique with per-company unique
ALTER TABLE "material_categories" DROP CONSTRAINT IF EXISTS "material_categories_name_key";
CREATE UNIQUE INDEX "material_categories_company_id_name_key"
  ON "material_categories"("company_id", "name");
CREATE INDEX "material_categories_company_id_idx" ON "material_categories"("company_id");

-- ============================================================
-- 5. Add company_id to materials
-- ============================================================
ALTER TABLE "materials" ADD COLUMN "company_id" UUID;
UPDATE "materials" SET "company_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "materials" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "materials" ADD CONSTRAINT "materials_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Replace global sku unique with per-company unique (nullable sku)
ALTER TABLE "materials" DROP CONSTRAINT IF EXISTS "materials_sku_key";
CREATE UNIQUE INDEX "materials_company_id_sku_key"
  ON "materials"("company_id", "sku") WHERE "sku" IS NOT NULL;
CREATE INDEX "materials_company_id_idx" ON "materials"("company_id");

-- ============================================================
-- 6. Add company_id to warehouse_config
-- ============================================================
ALTER TABLE "warehouse_config" ADD COLUMN "company_id" UUID;
UPDATE "warehouse_config" SET "company_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "warehouse_config" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "warehouse_config" ADD CONSTRAINT "warehouse_config_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "warehouse_config_company_id_idx" ON "warehouse_config"("company_id");

-- ============================================================
-- 7. Add company_id to inventory_movements
-- ============================================================
ALTER TABLE "inventory_movements" ADD COLUMN "company_id" UUID;
UPDATE "inventory_movements" SET "company_id" = '00000000-0000-0000-0000-000000000001';
ALTER TABLE "inventory_movements" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "inventory_movements_company_id_idx" ON "inventory_movements"("company_id");
