-- Fix: Drop existing RLS policies to recreate them safely
DROP POLICY IF EXISTS "tenant_isolation" ON "users";
DROP POLICY IF EXISTS "tenant_isolation" ON "material_categories";
DROP POLICY IF EXISTS "tenant_isolation" ON "materials";
DROP POLICY IF EXISTS "tenant_isolation" ON "warehouse_config";
DROP POLICY IF EXISTS "tenant_isolation" ON "inventory_movements";

-- Feature: Create AppModule enum
CREATE TYPE "AppModule" AS ENUM ('inventario', 'operaciones', 'flotas', 'clientes', 'finanzas', 'admin');

-- Fix: Convert companies.id safely to UUID
ALTER TABLE "companies" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

-- Feature: Convert active_modules from TEXT[] to AppModule[]
-- First drop default to avoid type mismatch during conversion
ALTER TABLE "companies" ALTER COLUMN "active_modules" DROP DEFAULT;

-- Perform the conversion using explicit casting
ALTER TABLE "companies" 
  ALTER COLUMN "active_modules" TYPE "AppModule"[] 
  USING "active_modules"::text[]::"AppModule"[];

-- Set new default with correct enum type
ALTER TABLE "companies" ALTER COLUMN "active_modules" SET DEFAULT ARRAY['inventario']::"AppModule"[];

-- Fix: Recreate RLS policies safely casting company_id to text for comparison with current_setting
CREATE POLICY "tenant_isolation" ON "users"
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "tenant_isolation" ON "material_categories"
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "tenant_isolation" ON "materials"
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "tenant_isolation" ON "warehouse_config"
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "tenant_isolation" ON "inventory_movements"
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));
