import type { Response } from "express";
import { ZodError } from "zod";

// Warden error envelope — single chokepoint for translating any failure
// surfaced from a Warden route (REST or SSE) into the on-the-wire shape
// defined by contracts/warden-api.md §Errors:
//
//   {
//     "error": {
//       "code": "WARDEN_*",
//       "message": "Mensaje en español para mostrar al usuario."
//     }
//   }
//
// Two responsibilities that tool / stream handlers MUST NOT reimplement:
//
//   (a) Map a canonical `WardenErrorCode` to (1) a stable HTTP status and
//       (2) a user-facing Spanish message. Handlers reference the code;
//       this module owns the status and copy so a typo in one route
//       can't ship a 500 instead of a 403.
//
//   (b) Strip tenant/user identifiers from error messages before they
//       leave the process. Principle V is defence-in-depth: even an
//       accidental `err.message` containing a `companyId` must be
//       redacted before it reaches the client or the SSE frame.
//
// This file is pure data + pure functions — no Prisma, no Anthropic, no
// logging side-effects. The only Express dependency is the `sendError`
// helper that writes the envelope to a `Response`; SSE streams call
// `toErrorFrame` instead.

export type WardenErrorCode =
  | "WARDEN_VALIDATION"
  | "WARDEN_UNAUTHENTICATED"
  | "WARDEN_MODULE_DISABLED"
  | "WARDEN_NOT_FOUND"
  | "WARDEN_RATE_LIMITED"
  | "WARDEN_LLM_ERROR"
  | "WARDEN_INTERNAL";

interface WardenErrorMeta {
  status: number;
  defaultMessage: string;
}

// Canonical mapping. Status codes MUST match contracts/warden-api.md.
// Default messages are the fallback when a caller does not supply a
// per-call override — they are intentionally generic so they do not
// leak what the server actually did or did not find.
const ERROR_META: Record<WardenErrorCode, WardenErrorMeta> = {
  WARDEN_VALIDATION: {
    status: 400,
    defaultMessage: "La solicitud no es válida.",
  },
  WARDEN_UNAUTHENTICATED: {
    status: 401,
    defaultMessage: "Tu sesión expiró. Vuelve a iniciar sesión.",
  },
  WARDEN_MODULE_DISABLED: {
    status: 403,
    defaultMessage:
      "Tu plan no incluye Warden. Actualiza tu suscripción para continuar.",
  },
  WARDEN_NOT_FOUND: {
    status: 404,
    defaultMessage: "No encontramos lo que buscabas.",
  },
  WARDEN_RATE_LIMITED: {
    status: 429,
    defaultMessage:
      "Estás enviando mensajes muy rápido. Espera unos segundos e inténtalo de nuevo.",
  },
  WARDEN_LLM_ERROR: {
    status: 500,
    defaultMessage: "Warden no pudo responder. Intenta de nuevo en un momento.",
  },
  WARDEN_INTERNAL: {
    status: 500,
    defaultMessage: "Algo salió mal. Intenta de nuevo en un momento.",
  },
};

export class WardenError extends Error {
  readonly code: WardenErrorCode;
  readonly status: number;

  constructor(code: WardenErrorCode, message?: string) {
    const meta = ERROR_META[code];
    super(message ?? meta.defaultMessage);
    this.name = "WardenError";
    this.code = code;
    this.status = meta.status;
  }
}

// UUIDs (company ids, user ids, conversation ids) MUST NEVER reach the
// client inside an error message. We redact both v4 uuids and bare
// 32-hex sequences. Tokens that look like bearer/JWT fragments are also
// scrubbed — conservative pattern, easy to extend.
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX32_RE = /\b[0-9a-f]{32}\b/gi;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/gi;

function sanitizeMessage(message: string): string {
  return message
    .replace(UUID_RE, "[redacted]")
    .replace(HEX32_RE, "[redacted]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .trim();
}

export interface WardenErrorPayload {
  error: {
    code: WardenErrorCode;
    message: string;
  };
}

export function toErrorPayload(
  code: WardenErrorCode,
  message?: string
): WardenErrorPayload {
  const resolved = message ?? ERROR_META[code].defaultMessage;
  return {
    error: {
      code,
      message: sanitizeMessage(resolved),
    },
  };
}

/**
 * Normalize any thrown value into `{ code, status, payload }`. Used by
 * both the Express error handler (T041 will wire it) and the SSE
 * handler's catch block (T040).
 */
export function normalizeError(err: unknown): {
  code: WardenErrorCode;
  status: number;
  payload: WardenErrorPayload;
} {
  if (err instanceof WardenError) {
    return {
      code: err.code,
      status: err.status,
      payload: toErrorPayload(err.code, err.message),
    };
  }

  if (err instanceof ZodError) {
    const detail = err.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      code: "WARDEN_VALIDATION",
      status: ERROR_META.WARDEN_VALIDATION.status,
      payload: toErrorPayload("WARDEN_VALIDATION", detail || undefined),
    };
  }

  // Unknown failure — never forward the raw message to the client.
  // Server-side logging (done elsewhere) keeps the full detail.
  return {
    code: "WARDEN_INTERNAL",
    status: ERROR_META.WARDEN_INTERNAL.status,
    payload: toErrorPayload("WARDEN_INTERNAL"),
  };
}

/**
 * Write a Warden error envelope to an Express response. Safe to call
 * from any route handler or middleware; does nothing if headers have
 * already been sent (SSE routes will have called `toErrorFrame`
 * instead).
 */
export function sendError(res: Response, err: unknown): void {
  if (res.headersSent) return;
  const { status, payload } = normalizeError(err);
  res.status(status).json(payload);
}

/**
 * Format a Warden error as an SSE `event: error` frame per
 * contracts/warden-sse.md. Returns the exact bytes to `res.write(...)`
 * — trailing `\n\n` included. Callers are responsible for ending the
 * response after writing.
 */
export function toErrorFrame(err: unknown): string {
  const { payload } = normalizeError(err);
  return `event: error\ndata: ${JSON.stringify(payload.error)}\n\n`;
}
