-- Migration: Restore company_id foreign keys (Phase 2 drift fix)
--
-- Root cause: migration 20260331000000_db_and_rls_fixes changed
-- company_id from TEXT to UUID via `ALTER COLUMN ... TYPE UUID USING ...`.
-- Postgres auto-drops FKs when the referenced column type changes, and
-- that migration never recreated them. Result: 5 tables in dev lost
-- their `company_id -> companies.id` FK, causing Prisma drift that
-- blocked every subsequent `prisma migrate dev` invocation.
--
-- Pre-fix audit (2026-04-11): verified zero orphan rows across all 5
-- tables (no u.company_id without a matching companies.id), so the
-- restore is safe without data cleanup.
--
-- The FK definitions match the pattern used by every other tenant FK
-- in this schema: ON UPDATE CASCADE ON DELETE RESTRICT.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_company_id_fkey";
ALTER TABLE "users"
    ADD CONSTRAINT "users_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_categories" DROP CONSTRAINT IF EXISTS "material_categories_company_id_fkey";
ALTER TABLE "material_categories"
    ADD CONSTRAINT "material_categories_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "materials" DROP CONSTRAINT IF EXISTS "materials_company_id_fkey";
ALTER TABLE "materials"
    ADD CONSTRAINT "materials_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouse_config" DROP CONSTRAINT IF EXISTS "warehouse_config_company_id_fkey";
ALTER TABLE "warehouse_config"
    ADD CONSTRAINT "warehouse_config_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_movements" DROP CONSTRAINT IF EXISTS "inventory_movements_company_id_fkey";
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
