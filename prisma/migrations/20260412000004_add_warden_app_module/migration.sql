-- Migration: Add 'warden' to AppModule enum (Phase 2, T021)
--
-- Enables `checkModuleAccess('warden')` to gate /api/warden/* routes on
-- the caller's tenant having `warden` in `companies.active_modules`.
-- Without this value, `active_modules.includes('warden' as AppModule)`
-- is a type-level lie at runtime: the Postgres enum would reject inserts
-- attempting to add 'warden' to the array.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block. Prisma
-- migrate runs each migration file in its own implicit transaction, so
-- this file MUST contain only the single ADD VALUE statement.

ALTER TYPE "AppModule" ADD VALUE 'warden';
