-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "message_cards" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warden_audit" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warden_tool_invocations" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "conversations_company_updated_idx" RENAME TO "conversations_company_id_updated_at_idx";

-- RenameIndex
ALTER INDEX "conversations_company_user_updated_idx" RENAME TO "conversations_company_id_user_id_updated_at_idx";

-- RenameIndex
ALTER INDEX "message_cards_company_type_idx" RENAME TO "message_cards_company_id_card_type_idx";

-- RenameIndex
ALTER INDEX "message_cards_message_position_idx" RENAME TO "message_cards_message_id_position_idx";

-- RenameIndex
ALTER INDEX "messages_company_created_idx" RENAME TO "messages_company_id_created_at_idx";

-- RenameIndex
ALTER INDEX "messages_conversation_created_idx" RENAME TO "messages_conversation_id_created_at_idx";

-- RenameIndex
ALTER INDEX "warden_audit_company_created_idx" RENAME TO "warden_audit_company_id_created_at_idx";

-- RenameIndex
ALTER INDEX "warden_audit_company_user_created_idx" RENAME TO "warden_audit_company_id_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "warden_tool_invocations_company_created_idx" RENAME TO "warden_tool_invocations_company_id_created_at_idx";

-- RenameIndex
ALTER INDEX "warden_tool_invocations_company_tool_created_idx" RENAME TO "warden_tool_invocations_company_id_tool_name_created_at_idx";
