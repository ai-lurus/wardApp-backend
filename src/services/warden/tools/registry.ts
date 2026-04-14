import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { z } from "zod";
import type { PrismaClient } from "@prisma/client";

// Warden tool registry.
//
// A Warden tool is the narrow contract between the LLM and one backend
// operation (e.g. `list_units`, `get_diesel_anomalies`). It never receives
// `companyId` from the model — the executor injects tenancy via
// `withTenant()` (Principle V). The registry is deliberately a plain map
// owned at process start: lookups are hot-path in every turn, and a
// mutable registry is trivial to reason about from tests.
//
// Individual tools land in Phase 5 (US3). This file only provides the
// shape + the register/list/get primitives that the executor (T019) and
// the Anthropic payload builder will consume.

export type WardenToolHandler<TArgs> = (
  tx: PrismaClient,
  args: TArgs,
  ctx: WardenToolContext
) => Promise<WardenToolResult>;

export interface WardenToolContext {
  companyId: string;
  userId: string;
  conversationId: string;
}

export interface WardenToolResult {
  // Free-form payload returned to the LLM as the tool_result. Kept as
  // `unknown` because the registry does not own output typing — each tool
  // defines its own output contract and the executor serializes it.
  data: unknown;
  // Optional structured card emitted alongside the text result. Validated
  // by `validateCardPayload` in `cards.schemas.ts` before persistence.
  card?: {
    card_type: "reporte" | "alerta" | "operador";
    payload: unknown;
  };
}

export interface WardenToolDefinition<TArgs = unknown> {
  // Registry key and the `name` sent to Anthropic in the tool schema.
  // Convention: snake_case verb_object (e.g. `list_units`).
  name: string;
  // Owning module slug — must match an entry in `active_modules` on the
  // company row. Used by `list({ activeModules })` to filter what the LLM
  // even sees per tenant.
  module: string;
  // Human-readable description shown to the LLM. Keep under ~200 chars;
  // long descriptions bloat the cached tool breakpoint.
  description: string;
  // Zod schema for the tool's input. The executor parses args with this
  // BEFORE calling the handler, and rejects any payload that contains a
  // `companyId` key (defense-in-depth for Principle V).
  argsSchema: z.ZodType<TArgs>;
  // JSON Schema sent to Anthropic. Kept separate from the Zod schema
  // because Anthropic wants the raw JSON Schema shape and we don't want
  // to pull in `zod-to-json-schema` just for this.
  inputSchema: Tool.InputSchema;
  handler: WardenToolHandler<TArgs>;
}

const _registry = new Map<string, WardenToolDefinition<unknown>>();

export function register<TArgs>(tool: WardenToolDefinition<TArgs>): void {
  if (_registry.has(tool.name)) {
    throw new Error(
      `Warden tool "${tool.name}" ya está registrado. Los nombres deben ser únicos.`
    );
  }
  _registry.set(tool.name, tool as WardenToolDefinition<unknown>);
}

export function get(name: string): WardenToolDefinition<unknown> | undefined {
  return _registry.get(name);
}

export interface ListToolsOptions {
  activeModules: string[];
}

/**
 * Return the list of tools visible to a given tenant, filtered by the
 * `active_modules` set from their company row. A tool whose `module` is
 * not active is simply never advertised to the LLM — this is the only
 * place module-gating happens for tool use. Order is stable (insertion
 * order) so the cache breakpoint on the last tool stays deterministic.
 */
export function list(
  options: ListToolsOptions
): WardenToolDefinition<unknown>[] {
  const active = new Set(options.activeModules);
  const out: WardenToolDefinition<unknown>[] = [];
  for (const tool of _registry.values()) {
    if (active.has(tool.module)) out.push(tool);
  }
  return out;
}

/**
 * Build the `Tool[]` array ready to hand to `streamWithCache`. The
 * executor stays separate from Anthropic payload shaping: this helper
 * only projects `{name, description, input_schema}` from the registry.
 */
export function toAnthropicTools(
  tools: WardenToolDefinition<unknown>[]
): Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

/**
 * Test-only: wipe the registry between test cases. Never call this from
 * production code — tools are registered once at module load and stay
 * for the process lifetime.
 */
export function _resetForTests(): void {
  _registry.clear();
}
