-- Fix company_id type from text to uuid in all tenant tables
-- and update RLS policies accordingly

-- Drop policies first (required before altering column types)
DROP POLICY IF EXISTS tenant_isolation ON users;
DROP POLICY IF EXISTS tenant_isolation ON materials;
DROP POLICY IF EXISTS tenant_isolation ON material_categories;
DROP POLICY IF EXISTS tenant_isolation ON inventory_movements;
DROP POLICY IF EXISTS tenant_isolation ON warehouse_config;

-- Change company_id from text to uuid
ALTER TABLE users ALTER COLUMN company_id TYPE UUID USING company_id::UUID;
ALTER TABLE materials ALTER COLUMN company_id TYPE UUID USING company_id::UUID;
ALTER TABLE material_categories ALTER COLUMN company_id TYPE UUID USING company_id::UUID;
ALTER TABLE inventory_movements ALTER COLUMN company_id TYPE UUID USING company_id::UUID;
ALTER TABLE warehouse_config ALTER COLUMN company_id TYPE UUID USING company_id::UUID;

-- Recreate RLS policies (company_id is now uuid, cast to text for comparison)
CREATE POLICY tenant_isolation ON users
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY tenant_isolation ON materials
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY tenant_isolation ON material_categories
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY tenant_isolation ON inventory_movements
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY tenant_isolation ON warehouse_config
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));
