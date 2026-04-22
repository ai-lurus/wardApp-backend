import Anthropic from "@anthropic-ai/sdk";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import type {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import { env } from "../config/env";

// Warden's only entry point to the Anthropic API.
//
// Two responsibilities:
//
//   1. Own the single `Anthropic` client instance (keeps connection
//      pooling happy; instantiating per-request leaks sockets).
//   2. Build the `messages.stream(...)` request with prompt-cache
//      breakpoints that are TENANT-SCOPED per Principle V.
//
// Why tenant-scoping matters: Anthropic's prompt cache is keyed by
// content hash of the prefix up to each `cache_control` breakpoint.
// If two tenants ever sent the EXACT same system prompt + tool schemas,
// they'd share cached prefix tokens — which means Warden's KV cache for
// Tenant A could be used to warm-start a completion for Tenant B. That
// would be a Principle V violation even though no tenant row data is
// actually leaking.
//
// Fix: prepend `tenant:${companyId}:` to the system prompt string
// BEFORE the cache breakpoint. Now each tenant has a unique prefix hash
// and the cache is partitioned per tenant by construction. The tenant
// prefix itself is non-sensitive (just a UUID) — the LLM sees it but
// has no tool to act on it, and `companyId` is already injected
// server-side into every tool call, not supplied by the model.
//
// Cache layout (two breakpoints, Anthropic's free-tier max for now):
//
//   system = [
//     {type: "text", text: "tenant:${companyId}:\n\n${systemPrompt}",
//      cache_control: {type: "ephemeral"}},   <- breakpoint 1
//   ]
//   tools = [ ...tools[0..n-2], {...tools[n-1],
//             cache_control: {type: "ephemeral"}} ]   <- breakpoint 2
//
// Everything after the last cached tool (i.e. `messages`) is NOT
// cached — that's the conversation turn, small, and varies per request.
// Research: specs/001-warden-foundations/research.md §2.

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurada. Warden requiere una clave de Anthropic."
    );
  }
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

export interface StreamWithCacheParams {
  companyId: string;
  systemPrompt: string;
  tools: Tool[];
  messages: MessageParam[];
  maxTokens?: number;
}

/**
 * Build the tenant-scoped cached system block.
 *
 * Exported for unit tests that want to verify the tenant prefix is
 * applied and that `cache_control` is attached — without actually
 * hitting the Anthropic API.
 */
export function buildSystemBlocks(
  companyId: string,
  systemPrompt: string
): Array<{
  type: "text";
  text: string;
  cache_control: { type: "ephemeral" };
}> {
  return [
    {
      type: "text",
      text: `tenant:${companyId}:\n\n${systemPrompt}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * Attach the prompt-cache breakpoint to the last tool. Returns a NEW
 * array (immutable; the caller's registry output is untouched).
 *
 * Exported for unit tests.
 */
export function withToolCacheBreakpoint(tools: Tool[]): Tool[] {
  if (tools.length === 0) return tools;
  const last = tools[tools.length - 1];
  const cached: Tool = {
    ...last,
    cache_control: { type: "ephemeral" },
  };
  return [...tools.slice(0, -1), cached];
}

/**
 * Stream a Warden completion with tenant-scoped prompt caching.
 *
 * The returned `MessageStream` is an async iterable of SDK events; the
 * caller (SSE handler in `warden.routes.ts`) is responsible for
 * translating those events into SSE frames and for handling tool use.
 *
 * Note: this wrapper does NOT run tools. Tool execution lives in
 * `src/services/warden/tools/executor.ts` — which is the only place
 * allowed to open `withTenant(companyId, ...)` blocks, per Principle V.
 */
export function streamWithCache(params: StreamWithCacheParams): MessageStream {
  const { companyId, systemPrompt, tools, messages, maxTokens = 4096 } = params;

  if (!companyId) {
    throw new Error("streamWithCache: companyId requerido");
  }

  return getClient().messages.stream({
    model: env.WARDEN_MODEL,
    max_tokens: maxTokens,
    system: buildSystemBlocks(companyId, systemPrompt),
    tools: withToolCacheBreakpoint(tools),
    messages,
  });
}
