import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { withTenant } from "../../../lib/prisma";
import { writeToolAudit } from "../audit.service";
import { get, type WardenToolContext } from "./registry";

// Warden tool executor — the single chokepoint that takes a tool call
// emitted by Anthropic and runs the handler inside the correct tenant
// context. Owns every responsibility that individual tools MUST NOT
// duplicate:
//
//   (a) Zod-validates the args dict.
//   (b) Rejects any args payload that carries `companyId` — the model
//       must never try to address another tenant, even "helpfully"
//       (Principle V; defense in depth).
//   (c) Enforces module gating via `active_modules`. A tool registered
//       under a module the caller's tenant does not have is invisible
//       here just as it is in `registry.list()`.
//   (d) Wraps the handler in `withTenant(companyId, ...)` so the
//       handler's tx is the only Prisma surface it ever touches.
//   (e) Writes BOTH a `warden_tool_invocations` row AND a `warden_audit`
//       row inside the same transaction — they always commit together.
//
// Everything the executor writes happens inside ONE `withTenant` call so
// the invocation log and the business read are atomic per the tenant
// GUC. Timing is measured around the handler only; DB writes inside the
// same tx are excluded from `latency_ms` so the number reflects tool
// work, not audit overhead.

export interface ExecuteToolParams {
  toolName: string;
  toolUseId: string;
  args: unknown;
  ctx: WardenToolContext;
  activeModules: string[];
}

export type ExecuteToolResult =
  | {
      ok: true;
      toolUseId: string;
      toolName: string;
      output: unknown;
      card?: {
        card_type: "reporte" | "alerta" | "operador";
        payload: unknown;
      };
      latencyMs: number;
    }
  | {
      ok: false;
      toolUseId: string;
      toolName: string;
      errorCode: WardenToolErrorCode;
      errorMessage: string;
      latencyMs: number;
    };

export type WardenToolErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_MODULE_DISABLED"
  | "TOOL_ARGS_INVALID"
  | "TOOL_ARGS_REJECTED_COMPANY_ID"
  | "TOOL_HANDLER_ERROR";

export class WardenToolError extends Error {
  readonly code: WardenToolErrorCode;
  constructor(code: WardenToolErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WardenToolError";
  }
}

// Max bytes we persist in `warden_tool_invocations.output_json`. The full
// data stays in the source tables; the audit row is just enough to
// reconstruct "what did Warden see". 8 KB matches data-model.md §4.
const MAX_OUTPUT_JSON_BYTES = 8 * 1024;

function truncateOutput(value: unknown): unknown {
  try {
    const json = JSON.stringify(value ?? null);
    if (json.length <= MAX_OUTPUT_JSON_BYTES) return value;
    return { _truncated: true, preview: json.slice(0, MAX_OUTPUT_JSON_BYTES) };
  } catch {
    return { _truncated: true, preview: "<unserializable>" };
  }
}

function argsContainCompanyId(args: unknown): boolean {
  if (!args || typeof args !== "object") return false;
  return Object.prototype.hasOwnProperty.call(args, "companyId");
}

/**
 * Execute a single Warden tool call. Never throws into the caller: any
 * failure is returned as a discriminated-union `{ ok: false, errorCode }`
 * so the SSE handler can emit a `tool_result` frame and continue the
 * turn instead of tearing down the stream.
 */
export async function executeTool(
  params: ExecuteToolParams
): Promise<ExecuteToolResult> {
  const { toolName, toolUseId, args, ctx, activeModules } = params;

  const tool = get(toolName);
  if (!tool) {
    return failureWithoutAudit(
      toolUseId,
      toolName,
      "TOOL_NOT_FOUND",
      `Herramienta "${toolName}" no existe.`
    );
  }

  if (!activeModules.includes(tool.module)) {
    return failureWithoutAudit(
      toolUseId,
      toolName,
      "TOOL_MODULE_DISABLED",
      `El módulo "${tool.module}" no está activo para este tenant.`
    );
  }

  if (argsContainCompanyId(args)) {
    return failureWithoutAudit(
      toolUseId,
      toolName,
      "TOOL_ARGS_REJECTED_COMPANY_ID",
      "Los argumentos no pueden incluir companyId."
    );
  }

  let parsedArgs: unknown;
  try {
    parsedArgs = tool.argsSchema.parse(args);
  } catch (err) {
    const message =
      err instanceof ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : "Argumentos inválidos.";
    return failureWithoutAudit(
      toolUseId,
      toolName,
      "TOOL_ARGS_INVALID",
      message
    );
  }

  const startedAt = Date.now();

  try {
    const result = await withTenant(ctx.companyId, async (tx) => {
      const handlerStart = Date.now();
      const handlerResult = await tool.handler(tx, parsedArgs, ctx);
      const handlerLatency = Date.now() - handlerStart;

      await tx.wardenToolInvocation.create({
        data: {
          company_id: ctx.companyId,
          conversation_id: ctx.conversationId,
          message_id: null,
          tool_name: toolName,
          module: tool.module,
          input_json: parsedArgs as object,
          output_json: truncateOutput(handlerResult.data) as object,
          ok: true,
          error_code: null,
          latency_ms: handlerLatency,
        },
      });

      await writeToolAudit(
        {
          companyId: ctx.companyId,
          userId: ctx.userId,
          conversationId: ctx.conversationId,
          toolName,
          ok: true,
          latencyMs: handlerLatency,
        },
        tx
      );

      return {
        data: handlerResult.data,
        card: handlerResult.card,
        latencyMs: handlerLatency,
      };
    });

    return {
      ok: true,
      toolUseId,
      toolName,
      output: result.data,
      card: result.card,
      latencyMs: result.latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage =
      err instanceof Error ? err.message : "Error desconocido en la herramienta.";

    // Handler blew up — record the failure in its own `withTenant` tx
    // since the inner one rolled back. Best-effort: if the audit write
    // ALSO fails we swallow the secondary error and still return the
    // original failure to the caller.
    try {
      await withTenant(ctx.companyId, async (tx) => {
        await tx.wardenToolInvocation.create({
          data: {
            company_id: ctx.companyId,
            conversation_id: ctx.conversationId,
            message_id: null,
            tool_name: toolName,
            module: tool.module,
            input_json: parsedArgs as object,
            output_json: Prisma.JsonNull,
            ok: false,
            error_code: "TOOL_HANDLER_ERROR",
            latency_ms: latencyMs,
          },
        });
        await writeToolAudit(
          {
            companyId: ctx.companyId,
            userId: ctx.userId,
            conversationId: ctx.conversationId,
            toolName,
            ok: false,
            latencyMs,
            errorCode: "TOOL_HANDLER_ERROR",
          },
          tx
        );
      });
    } catch {
      // Silencioso — el fallo original es lo que importa.
    }

    return {
      ok: false,
      toolUseId,
      toolName,
      errorCode: "TOOL_HANDLER_ERROR",
      errorMessage,
      latencyMs,
    };
  }
}

// Failures that happen BEFORE we enter the tenant tx don't have audit
// rows — there's no tenant context to stamp them with, and they're not
// business events, they're rejected-at-boundary cases. The SSE handler
// is responsible for surfacing them to the model as a tool_result
// error block.
function failureWithoutAudit(
  toolUseId: string,
  toolName: string,
  errorCode: WardenToolErrorCode,
  errorMessage: string
): ExecuteToolResult {
  return {
    ok: false,
    toolUseId,
    toolName,
    errorCode,
    errorMessage,
    latencyMs: 0,
  };
}
