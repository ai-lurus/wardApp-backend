-- Migration: Enable RLS on units (Phase 2, T008a)
--
-- Fixes a Principle V regression: migration 20260406215052 created the
-- `units` table WITHOUT `ENABLE ROW LEVEL SECURITY`, so cross-tenant
-- reads are possible today via raw `prisma.unit.*` calls or any code
-- path that forgets withTenant().
--
-- Pre-merge code audit (2026-04-11):
--   - src/services/unit.service.ts: all 9 prisma access points wrapped
--     in withTenant() — safe.
--   - src/routes/unit.routes.ts: delegates to unit.service only — safe.
--   - scripts/seed-two-tenants.ts:92: uses prisma.unit.upsert() without
--     withTenant. Will start failing after this migration. Must be
--     patched in the same PR (see task T008a follow-up).
--
-- Pattern matches migration 20260309000001_enable_rls exactly.

ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "units"
    USING      (company_id = current_setting('app.current_company_id', true)::uuid)
    WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
