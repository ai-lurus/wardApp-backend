import type { PrismaClient } from "@prisma/client";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { validateCardPayload, type CardType } from "./cards.schemas";

export interface CreateConversationInput {
  companyId: string;
  userId: string;
  title?: string;
}

export interface AppendUserMessageInput {
  companyId: string;
  conversationId: string;
  text: string;
  moduleHint?: string;
}

export interface CreateAssistantMessageInput {
  companyId: string;
  conversationId: string;
}

export interface FinalizeAssistantMessageInput {
  messageId: string;
  content: string;
  status: "complete" | "partial" | "error";
  errorCode?: string;
}

export interface AttachCardInput {
  companyId: string;
  messageId: string;
  cardType: CardType;
  payload: unknown;
  position: number;
}

export interface UpdateConversationPreviewInput {
  conversationId: string;
  preview: string;
}

export interface GetConversationInput {
  conversationId: string;
  companyId: string;
  userId: string;
}

/**
 * Create a new conversation row. Must be called inside withTenant(companyId, ...).
 */
export async function createConversation(
  tx: PrismaClient,
  input: CreateConversationInput
) {
  return tx.conversation.create({
    data: {
      company_id: input.companyId,
      user_id: input.userId,
      title: input.title ?? "Nueva conversación",
    },
    select: { id: true, title: true, created_at: true, updated_at: true },
  });
}

/**
 * Append a user message to an existing conversation.
 * Must be called inside withTenant(companyId, ...).
 */
export async function appendUserMessage(
  tx: PrismaClient,
  input: AppendUserMessageInput
) {
  return tx.message.create({
    data: {
      company_id: input.companyId,
      conversation_id: input.conversationId,
      role: "user",
      content: input.text,
      module_hint: input.moduleHint ?? null,
      status: "complete",
    },
    select: { id: true },
  });
}

/**
 * Create the assistant message stub with status='streaming'.
 * The caller updates it to 'complete'/'partial'/'error' when the
 * Anthropic stream finishes via finalizeAssistantMessage().
 * Must be called inside withTenant(companyId, ...).
 */
export async function createAssistantMessage(
  tx: PrismaClient,
  input: CreateAssistantMessageInput
) {
  return tx.message.create({
    data: {
      company_id: input.companyId,
      conversation_id: input.conversationId,
      role: "warden",
      content: "",
      status: "streaming",
    },
    select: { id: true },
  });
}

/**
 * Set the final content + status on the assistant message.
 * Must be called inside withTenant(companyId, ...).
 */
export async function finalizeAssistantMessage(
  tx: PrismaClient,
  input: FinalizeAssistantMessageInput
) {
  return tx.message.update({
    where: { id: input.messageId },
    data: {
      content: input.content,
      status: input.status,
      error_code: input.errorCode ?? null,
    },
  });
}

/**
 * Persist a structured card row linked to the assistant message.
 * Validates the payload against the card type schema before writing.
 * Must be called inside withTenant(companyId, ...).
 */
export async function attachCard(
  tx: PrismaClient,
  input: AttachCardInput
) {
  const validatedPayload = validateCardPayload(input.cardType, input.payload);
  return tx.messageCard.create({
    data: {
      company_id: input.companyId,
      message_id: input.messageId,
      card_type: input.cardType,
      payload: validatedPayload as object,
      position: input.position,
    },
    select: { id: true, card_type: true, payload: true, position: true },
  });
}

/**
 * Update the conversation preview text and bump updated_at.
 * Must be called inside withTenant(companyId, ...).
 */
export async function updateConversationPreview(
  tx: PrismaClient,
  input: UpdateConversationPreviewInput
) {
  return tx.conversation.update({
    where: { id: input.conversationId },
    data: {
      preview: input.preview.slice(0, 160),
      updated_at: new Date(),
    },
  });
}

/**
 * Look up a conversation by id + company (cross-user access within tenant
 * is intentional in v1 — fleet managers may view each other's sessions).
 * Returns null if not found or soft-deleted. Must be called inside
 * withTenant(companyId, ...).
 */
export async function getConversationForTenant(
  tx: PrismaClient,
  input: GetConversationInput
) {
  return tx.conversation.findFirst({
    where: {
      id: input.conversationId,
      company_id: input.companyId,
      deleted_at: null,
    },
    select: { id: true, title: true, user_id: true },
  });
}

export interface ListConversationsInput {
  companyId: string;
  limit?: number;
  cursor?: string;
}

/**
 * List conversations for a tenant, newest first, with cursor-based pagination.
 * Must be called inside withTenant(companyId, ...).
 */
export async function listConversations(
  tx: PrismaClient,
  input: ListConversationsInput
) {
  const limit = Math.min(input.limit ?? 20, 50);
  const rows = await tx.conversation.findMany({
    where: { company_id: input.companyId, deleted_at: null },
    orderBy: { updated_at: "desc" },
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: { id: true, title: true, preview: true, created_at: true, updated_at: true },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: items.map((c) => ({
      id: c.id,
      title: c.title,
      preview: c.preview ?? "",
      createdAt: c.created_at.toISOString(),
      updatedAt: c.updated_at.toISOString(),
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

export interface GetConversationDetailInput {
  conversationId: string;
  companyId: string;
}

/**
 * Get a single conversation with all its messages and cards.
 * Returns null if not found. Must be called inside withTenant(companyId, ...).
 */
export async function getConversationDetail(
  tx: PrismaClient,
  input: GetConversationDetailInput
) {
  const conv = await tx.conversation.findFirst({
    where: { id: input.conversationId, company_id: input.companyId, deleted_at: null },
    select: {
      id: true,
      title: true,
      preview: true,
      created_at: true,
      updated_at: true,
      messages: {
        where: { status: { not: "error" } },
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          status: true,
          created_at: true,
          cards: {
            orderBy: { position: "asc" },
            select: { card_type: true, payload: true },
          },
        },
      },
    },
  });

  if (!conv) return null;

  return {
    id: conv.id,
    title: conv.title,
    preview: conv.preview ?? "",
    createdAt: conv.created_at.toISOString(),
    updatedAt: conv.updated_at.toISOString(),
    messages: conv.messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        status: m.status,
        createdAt: m.created_at.toISOString(),
        cards: m.cards.map((c) => ({ cardType: c.card_type, payload: c.payload })),
      })),
  };
}

/**
 * Load all non-error messages for a conversation in chronological order
 * and format them as Anthropic MessageParam objects. Skips empty
 * messages so the LLM never sees a blank turn.
 * Must be called inside withTenant(companyId, ...).
 */
export async function loadMessagesForPrompt(
  tx: PrismaClient,
  conversationId: string
): Promise<MessageParam[]> {
  const rows = await tx.message.findMany({
    where: {
      conversation_id: conversationId,
      status: { not: "error" },
    },
    orderBy: { created_at: "asc" },
    select: { role: true, content: true },
  });

  return rows
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));
}
