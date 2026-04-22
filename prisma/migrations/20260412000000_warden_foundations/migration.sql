-- Migration: Warden Foundations (Phase 2, T008)
--
-- Creates the 5 Warden tables: conversations, messages, message_cards,
-- warden_tool_invocations, warden_audit. Each table:
--   1. Has company_id UUID NOT NULL with FK → companies.id
--   2. ENABLE ROW LEVEL SECURITY
--   3. Policy using current_setting('app.current_company_id', true)::uuid
--      (matches src/lib/prisma.ts withTenant() convention — do NOT use
--      'app.company_id' as data-model.md v1 suggested; that key is never set)
--
-- Principle V: tenant isolation enforced at the database layer so the LLM
-- cannot leak cross-tenant data even if a tool handler forgets to filter.

-- ============================================================================
-- Table: conversations
-- ============================================================================
CREATE TABLE "conversations" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID        NOT NULL,
    "user_id"    UUID        NOT NULL,
    "title"      TEXT        NOT NULL DEFAULT 'Nueva conversación',
    "preview"    TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_company_user_updated_idx"
    ON "conversations" ("company_id", "user_id", "updated_at" DESC);

CREATE INDEX "conversations_company_updated_idx"
    ON "conversations" ("company_id", "updated_at" DESC);

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Table: messages
-- ============================================================================
CREATE TABLE "messages" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "company_id"      UUID         NOT NULL,
    "conversation_id" UUID         NOT NULL,
    "role"            TEXT         NOT NULL,
    "content"         TEXT         NOT NULL,
    "module_hint"     TEXT,
    "status"          TEXT         NOT NULL DEFAULT 'complete',
    "error_code"      TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_role_check"
        CHECK ("role" IN ('user', 'warden')),
    CONSTRAINT "messages_status_check"
        CHECK ("status" IN ('streaming', 'complete', 'error', 'partial'))
);

CREATE INDEX "messages_conversation_created_idx"
    ON "messages" ("conversation_id", "created_at" ASC);

CREATE INDEX "messages_company_created_idx"
    ON "messages" ("company_id", "created_at" DESC);

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Table: message_cards
-- ============================================================================
CREATE TABLE "message_cards" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID         NOT NULL,
    "message_id" UUID         NOT NULL,
    "card_type"  TEXT         NOT NULL,
    "payload"    JSONB        NOT NULL,
    "position"   INTEGER      NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_cards_card_type_check"
        CHECK ("card_type" IN ('reporte', 'alerta', 'operador'))
);

CREATE INDEX "message_cards_message_position_idx"
    ON "message_cards" ("message_id", "position" ASC);

CREATE INDEX "message_cards_company_type_idx"
    ON "message_cards" ("company_id", "card_type");

ALTER TABLE "message_cards"
    ADD CONSTRAINT "message_cards_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "message_cards"
    ADD CONSTRAINT "message_cards_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Table: warden_tool_invocations
-- ============================================================================
CREATE TABLE "warden_tool_invocations" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "company_id"      UUID         NOT NULL,
    "conversation_id" UUID         NOT NULL,
    "message_id"      UUID,
    "tool_name"       TEXT         NOT NULL,
    "module"          TEXT         NOT NULL,
    "input_json"      JSONB        NOT NULL,
    "output_json"     JSONB,
    "ok"              BOOLEAN      NOT NULL,
    "error_code"      TEXT,
    "latency_ms"      INTEGER      NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warden_tool_invocations_pkey" PRIMARY KEY ("id"),
    -- Principle V invariant: tool input must never contain companyId.
    CONSTRAINT "warden_tool_invocations_no_company_id_in_input_check"
        CHECK (NOT ("input_json" ? 'companyId'))
);

CREATE INDEX "warden_tool_invocations_company_created_idx"
    ON "warden_tool_invocations" ("company_id", "created_at" DESC);

CREATE INDEX "warden_tool_invocations_company_tool_created_idx"
    ON "warden_tool_invocations" ("company_id", "tool_name", "created_at" DESC);

ALTER TABLE "warden_tool_invocations"
    ADD CONSTRAINT "warden_tool_invocations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warden_tool_invocations"
    ADD CONSTRAINT "warden_tool_invocations_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warden_tool_invocations"
    ADD CONSTRAINT "warden_tool_invocations_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Table: warden_audit
-- ============================================================================
CREATE TABLE "warden_audit" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "company_id"      UUID         NOT NULL,
    "user_id"         UUID         NOT NULL,
    "conversation_id" UUID         NOT NULL,
    "message_id"      UUID,
    "kind"            TEXT         NOT NULL,
    "tool_name"       TEXT,
    "ok"              BOOLEAN      NOT NULL,
    "latency_ms"      INTEGER      NOT NULL,
    "input_tokens"    INTEGER,
    "output_tokens"   INTEGER,
    "error_code"      TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warden_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "warden_audit_kind_check"
        CHECK ("kind" IN ('message', 'tool'))
);

CREATE INDEX "warden_audit_company_created_idx"
    ON "warden_audit" ("company_id", "created_at" DESC);

CREATE INDEX "warden_audit_company_user_created_idx"
    ON "warden_audit" ("company_id", "user_id", "created_at" DESC);

ALTER TABLE "warden_audit"
    ADD CONSTRAINT "warden_audit_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warden_audit"
    ADD CONSTRAINT "warden_audit_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warden_audit"
    ADD CONSTRAINT "warden_audit_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warden_audit"
    ADD CONSTRAINT "warden_audit_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Row Level Security (Principle V)
-- ============================================================================
ALTER TABLE "conversations"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_cards"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warden_tool_invocations"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warden_audit"             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "conversations"
    USING      (company_id = current_setting('app.current_company_id', true)::uuid)
    WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "messages"
    USING      (company_id = current_setting('app.current_company_id', true)::uuid)
    WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "message_cards"
    USING      (company_id = current_setting('app.current_company_id', true)::uuid)
    WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "warden_tool_invocations"
    USING      (company_id = current_setting('app.current_company_id', true)::uuid)
    WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY "tenant_isolation" ON "warden_audit"
    USING      (company_id = current_setting('app.current_company_id', true)::uuid)
    WITH CHECK (company_id = current_setting('app.current_company_id', true)::uuid);
