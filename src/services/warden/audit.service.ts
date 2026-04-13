import type { PrismaClient } from "@prisma/client";
import { withTenant } from "../../lib/prisma";

// Warden audit writer — append-only per-turn and per-tool records in
// `warden_audit`. Two shapes share the table:
//
//   • kind='message' — one row per user turn, carries Anthropic usage
//     (input/output token counts) and whether the turn completed ok.
//   • kind='tool'    — one row per tool invocation, mirrors the more
//     detailed `warden_tool_invocations` row but flattened for the
//     per-user audit index.
//
// Every write goes through `withTenant(companyId, ...)` so RLS tags the
// row with the right tenant by construction. Callers that already hold a
// `Prisma.TransactionClient` (e.g. the executor, which runs inside one
// `withTenant` block for the whole tool call) can pass it as `tx` to
// piggyback on that transaction instead of opening a new one.

export interface MessageAuditInput {
  companyId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  ok: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: string;
}

export interface ToolAuditInput {
  companyId: string;
  userId: string;
  conversationId: string;
  messageId?: string;
  toolName: string;
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
}

type TxOrNull = PrismaClient | null;

async function insertMessageAudit(
  tx: PrismaClient,
  input: MessageAuditInput
): Promise<void> {
  await tx.wardenAudit.create({
    data: {
      company_id: input.companyId,
      user_id: input.userId,
      conversation_id: input.conversationId,
      message_id: input.messageId,
      kind: "message",
      tool_name: null,
      ok: input.ok,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      error_code: input.errorCode ?? null,
    },
  });
}

async function insertToolAudit(
  tx: PrismaClient,
  input: ToolAuditInput
): Promise<void> {
  await tx.wardenAudit.create({
    data: {
      company_id: input.companyId,
      user_id: input.userId,
      conversation_id: input.conversationId,
      message_id: input.messageId ?? null,
      kind: "tool",
      tool_name: input.toolName,
      ok: input.ok,
      latency_ms: input.latencyMs,
      input_tokens: null,
      output_tokens: null,
      error_code: input.errorCode ?? null,
    },
  });
}

/**
 * Append a `kind='message'` audit row for a completed (or failed) user
 * turn. `messageId` MUST reference the assistant-side message row that
 * this turn produced, so a per-message audit index can join back to
 * `messages`. Runs under `withTenant(companyId, ...)` unless an active
 * tx is passed.
 */
export async function writeMessageAudit(
  input: MessageAuditInput,
  tx: TxOrNull = null
): Promise<void> {
  if (tx) {
    await insertMessageAudit(tx, input);
    return;
  }
  await withTenant(input.companyId, (innerTx) =>
    insertMessageAudit(innerTx, input)
  );
}

/**
 * Append a `kind='tool'` audit row. Typically called by the tool
 * executor from inside the same `withTenant` transaction that ran the
 * tool handler — pass that `tx` to keep the write atomic with the
 * `warden_tool_invocations` row.
 */
export async function writeToolAudit(
  input: ToolAuditInput,
  tx: TxOrNull = null
): Promise<void> {
  if (tx) {
    await insertToolAudit(tx, input);
    return;
  }
  await withTenant(input.companyId, (innerTx) =>
    insertToolAudit(innerTx, input)
  );
}
