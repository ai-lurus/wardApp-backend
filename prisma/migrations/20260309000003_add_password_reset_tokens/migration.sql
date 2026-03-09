-- Migration: Add password_reset_tokens table

CREATE TABLE "password_reset_tokens" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"    TEXT         NOT NULL,
  "token"      TEXT         NOT NULL,
  "expires_at" TIMESTAMPTZ  NOT NULL,
  "used"       BOOLEAN      NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_token_key" UNIQUE ("token"),
  CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
