-- Migration: Add Stripe fields and active_modules to companies, image_url to materials

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id"     TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT,
  ADD COLUMN IF NOT EXISTS "subscription_status"    TEXT,
  ADD COLUMN IF NOT EXISTS "active_modules"         TEXT[] NOT NULL DEFAULT ARRAY['inventario']::TEXT[];

ALTER TABLE "materials"
  ADD COLUMN IF NOT EXISTS "image_url" TEXT;

