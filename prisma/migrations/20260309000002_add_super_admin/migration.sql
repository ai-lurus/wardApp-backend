-- Migration: Add platform company and super_admin role
-- The platform company owns super_admin users.
-- super_admin users can manage all tenants via /api/admin/* routes.

-- Platform company (Ward internal)
INSERT INTO "companies" ("id", "name", "slug")
VALUES ('00000000-0000-0000-0000-000000000000', 'Ward Platform', 'ward-platform')
ON CONFLICT ("id") DO NOTHING;

-- NOTE: To create the first super_admin run:
--   npm run seed:super-admin
-- Or insert manually:
--   INSERT INTO users (id, company_id, email, password_hash, name, role)
--   VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
--           'super@ward.io', '<bcrypt_hash>', 'Super Admin', 'super_admin');
