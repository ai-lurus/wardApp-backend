-- Enable Row Level Security
ALTER TABLE "operators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operator_documents" ENABLE ROW LEVEL SECURITY;

-- Create policies for "operators"
CREATE POLICY "tenant_isolation_operators_select"
    ON "operators" FOR SELECT
    USING ("company_id" = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_operators_insert"
    ON "operators" FOR INSERT
    WITH CHECK ("company_id" = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_operators_update"
    ON "operators" FOR UPDATE
    USING ("company_id" = current_setting('app.current_company_id', TRUE)::uuid)
    WITH CHECK ("company_id" = current_setting('app.current_company_id', TRUE)::uuid);

CREATE POLICY "tenant_isolation_operators_delete"
    ON "operators" FOR DELETE
    USING ("company_id" = current_setting('app.current_company_id', TRUE)::uuid);

-- Create policies for "operator_documents"
-- The operator_documents table doesn't have company_id directly, so we check the parent operator's company_id
CREATE POLICY "tenant_isolation_operator_documents_select"
    ON "operator_documents" FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "operators"
            WHERE "operators"."id" = "operator_documents"."operator_id"
            AND "operators"."company_id" = current_setting('app.current_company_id', TRUE)::uuid
        )
    );

CREATE POLICY "tenant_isolation_operator_documents_insert"
    ON "operator_documents" FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "operators"
            WHERE "operators"."id" = "operator_documents"."operator_id"
            AND "operators"."company_id" = current_setting('app.current_company_id', TRUE)::uuid
        )
    );

CREATE POLICY "tenant_isolation_operator_documents_update"
    ON "operator_documents" FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "operators"
            WHERE "operators"."id" = "operator_documents"."operator_id"
            AND "operators"."company_id" = current_setting('app.current_company_id', TRUE)::uuid
        )
    );

CREATE POLICY "tenant_isolation_operator_documents_delete"
    ON "operator_documents" FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "operators"
            WHERE "operators"."id" = "operator_documents"."operator_id"
            AND "operators"."company_id" = current_setting('app.current_company_id', TRUE)::uuid
        )
    );