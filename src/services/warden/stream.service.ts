// Warden SSE stream service — wraps Anthropic messages.stream into the
// Warden SSE event contract defined in contracts/warden-sse.md.
import type { Request, Response } from "express";
import type { MessageParam, TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { withTenant } from "../../lib/prisma";
import { streamWithCache } from "../../lib/anthropic";
import { executeTool } from "./tools/executor";
import { list, toAnthropicTools } from "./tools/registry";
import {
  createConversation,
  appendUserMessage,
  createAssistantMessage,
  finalizeAssistantMessage,
  attachCard,
  updateConversationPreview,
  loadMessagesForPrompt,
  getConversationForTenant,
} from "./conversations.service";
import { sendError, toErrorFrame, WardenError } from "./errors";
import type { CardType } from "./cards.schemas";

const SYSTEM_PROMPT = `Eres Warden, el sistema de inteligencia de flotas de Ward.io para empresas de transporte de carga en México.

Reglas de operación — léelas antes de responder:

1. ACTÚA PRIMERO, PREGUNTA DESPUÉS. Ante cualquier consulta sobre unidades, conductores, inventario, alertas o costos: consulta los datos disponibles de inmediato y presenta lo que encuentres. No pidas permiso ni expliques qué vas a hacer.

2. NUNCA menciones herramientas, sistemas, APIs, ni capacidades técnicas. El usuario no sabe ni le importa cómo obtienes los datos. Habla siempre en términos de flota: "Tu unidad T-203 está en mantenimiento", no "Según las herramientas disponibles...".

3. SI ALGO NO ESTÁ EN LOS DATOS, dilo en términos operativos. Ejemplo: "No tenemos datos de ubicación GPS en tiempo real para T-203. Lo que sí tenemos: su estado actual es mantenimiento desde el 15 de abril." Ofrece lo que sí tienes, sin explicar por qué no tienes lo otro.

4. RESPONDE EN ESPAÑOL DE MÉXICO, conciso y directo. Los usuarios son profesionales del transporte con poco tiempo.

5. NUNCA inventes datos. Si no hay información, dilo claramente y ofrece la consulta más cercana que sí puedas hacer.

6. Para preguntas completamente fuera del dominio de flota y transporte, indica brevemente que estás especializado en operaciones de flota.`;

// Maximum tool-calling rounds before forcing a final text generation.
// One additional LLM call always follows (the final text response), so
// the absolute maximum is MAX_TOOL_ROUNDS + 1 total Anthropic calls.
const MAX_TOOL_ROUNDS = 4;

export interface RunStreamParams {
  req: Request;
  res: Response;
  companyId: string;
  userId: string;
  conversationId: string | null;
  text: string;
  moduleHint?: string;
  activeModules: string[];
}

/**
 * Run the full Warden agentic loop over SSE.
 *
 * Four phases:
 *   1. DB setup inside withTenant — errors here return JSON (headers not sent).
 *   2. SSE headers + conversation/message_start events.
 *   3. Agentic loop: up to MAX_TOOL_ROUNDS tool rounds, then one streaming
 *      final-text round. Emits tool_call, tool_result, card, and token events.
 *   4. Persist finalized message + cards, emit message_end, close.
 *
 * Client disconnect: req.on("close") sets `streamFinalized` and persists
 * the message as "partial". Subsequent writes to res are no-ops.
 */
export async function runStream(params: RunStreamParams): Promise<void> {
  const { req, res, companyId, userId, text, moduleHint, activeModules } = params;

  // ── Phase 1: DB setup ────────────────────────────────────────────────────
  let convId: string;
  let isNewConversation: boolean;
  let assistantMessageId: string;
  let historyMessages: MessageParam[];

  try {
    const setup = await withTenant(companyId, async (tx) => {
      let cid = params.conversationId;
      let newConv = false;

      if (!cid) {
        const conv = await createConversation(tx, { companyId, userId });
        cid = conv.id;
        newConv = true;
      } else {
        const existing = await getConversationForTenant(tx, {
          conversationId: cid,
          companyId,
          userId,
        });
        if (!existing) {
          throw new WardenError("WARDEN_NOT_FOUND", "Conversación no encontrada.");
        }
      }

      const history = await loadMessagesForPrompt(tx, cid);
      await appendUserMessage(tx, { companyId, conversationId: cid, text, moduleHint });
      const assistantMsg = await createAssistantMessage(tx, { companyId, conversationId: cid });

      return { cid, newConv, history, assistantMsgId: assistantMsg.id };
    });

    convId = setup.cid;
    isNewConversation = setup.newConv;
    assistantMessageId = setup.assistantMsgId;
    historyMessages = setup.history;
  } catch (err) {
    sendError(res, err);
    return;
  }

  // ── Phase 2: SSE headers ─────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  if (isNewConversation) {
    res.write(`event: conversation\ndata: ${JSON.stringify({ id: convId })}\n\n`);
  }
  res.write(`event: message_start\ndata: ${JSON.stringify({ messageId: assistantMessageId })}\n\n`);

  // Disconnect: finalize as partial so the client can resume later.
  let streamFinalized = false;
  req.on("close", () => {
    if (!streamFinalized) {
      streamFinalized = true;
      withTenant(companyId, (tx) =>
        finalizeAssistantMessage(tx, {
          messageId: assistantMessageId,
          content: "",
          status: "partial",
        })
      ).catch(() => {});
    }
  });

  // ── Phase 3: Agentic loop ─────────────────────────────────────────────────
  const anthropicTools = toAnthropicTools(list({ activeModules }));
  const messages: MessageParam[] = [...historyMessages, { role: "user", content: text }];
  const collectedCards: Array<{ card_type: CardType; payload: unknown }> = [];
  let finalText = "";

  try {
    // Tool rounds — run synchronously; tokens are not streamed here so the
    // card events can be emitted before the final text tokens.
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (streamFinalized) return;

      const stream = streamWithCache({
        companyId,
        systemPrompt: SYSTEM_PROMPT,
        tools: anthropicTools,
        messages,
      });
      const message = await stream.finalMessage();

      if (message.stop_reason !== "tool_use") {
        // LLM answered directly without calling tools — capture text and exit.
        finalText = message.content
          .filter((b): b is TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        break;
      }

      // Push the assistant's tool_use turn so history stays coherent.
      messages.push({ role: "assistant", content: message.content });

      const toolResultContent: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];

      const ctx = { companyId, userId, conversationId: convId };

      for (const block of message.content) {
        if (block.type !== "tool_use") continue;
        if (streamFinalized) break;

        res.write(
          `event: tool_call\ndata: ${JSON.stringify({
            toolName: block.name,
            toolUseId: block.id,
          })}\n\n`
        );

        const result = await executeTool({
          toolName: block.name,
          toolUseId: block.id,
          args: block.input,
          ctx,
          activeModules,
        });

        res.write(
          `event: tool_result\ndata: ${JSON.stringify({
            toolUseId: block.id,
            ok: result.ok,
          })}\n\n`
        );

        if (result.ok) {
          if (result.card) {
            collectedCards.push(result.card as { card_type: CardType; payload: unknown });
          }
          toolResultContent.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result.output),
          });
        } else {
          toolResultContent.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: result.errorMessage, code: result.errorCode }),
          });
        }
      }

      messages.push({ role: "user", content: toolResultContent });
    }

    if (streamFinalized) return;

    // Emit cards before text so the client can render them first.
    for (const card of collectedCards) {
      res.write(
        `event: card\ndata: ${JSON.stringify({
          cardType: card.card_type,
          payload: card.payload,
        })}\n\n`
      );
    }

    if (finalText) {
      // Direct answer (no tools) — emit accumulated text as a single token event.
      res.write(`event: token\ndata: ${JSON.stringify({ token: finalText })}\n\n`);
    } else {
      // Tools ran — do one final streaming LLM call and emit tokens in real-time.
      const finalStream = streamWithCache({
        companyId,
        systemPrompt: SYSTEM_PROMPT,
        tools: anthropicTools,
        messages,
      });

      finalStream.on("text", (token) => {
        if (!streamFinalized) {
          finalText += token;
          res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
        }
      });

      await finalStream.finalMessage();
    }

    if (streamFinalized) return;

    // ── Phase 4: Persist and close ──────────────────────────────────────────
    streamFinalized = true;

    await withTenant(companyId, async (tx) => {
      for (let i = 0; i < collectedCards.length; i++) {
        await attachCard(tx, {
          companyId,
          messageId: assistantMessageId,
          cardType: collectedCards[i].card_type,
          payload: collectedCards[i].payload,
          position: i,
        });
      }
      await finalizeAssistantMessage(tx, {
        messageId: assistantMessageId,
        content: finalText,
        status: "complete",
      });
      await updateConversationPreview(tx, { conversationId: convId, preview: finalText });
    });

    res.write(`event: message_end\ndata: ${JSON.stringify({ status: "complete" })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[warden:stream] error in agentic loop:", err);
    if (!streamFinalized) {
      streamFinalized = true;
      res.write(toErrorFrame(err));
      await withTenant(companyId, (tx) =>
        finalizeAssistantMessage(tx, {
          messageId: assistantMessageId,
          content: finalText,
          status: "error",
          errorCode: "WARDEN_LLM_ERROR",
        })
      ).catch(() => {});
      res.end();
    }
  }
}
