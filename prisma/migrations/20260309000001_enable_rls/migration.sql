-- Migration: Enable Row Level Security (Phase 2)
--
-- PREREQUISITE: All service calls must use withTenant() from src/lib/prisma.ts
-- so that `app.current_company_id` is set before every query.
--
-- withTenant() wraps queries in a transaction that sets the session variable:
--   SELECT set_config('app.current_company_id', $companyId, true)
--
-- Once this migration is applied, any query without the session variable
-- will return zero rows (safe fail-closed behavior).

ALTER TABLE "users"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "material_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "materials"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_config"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "users"
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "material_categories"
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "materials"
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "warehouse_config"
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "inventory_movements"
  USING (company_id = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
