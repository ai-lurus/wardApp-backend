import { z } from "zod";

// Warden card payload schemas — validated before a `message_cards` row is
// written. Shapes mirror `sampleData.ai.conversations[*].cardData` in the
// prototype's `ai-data.js` exactly (Principle III) and the table definition
// in `specs/001-warden-foundations/data-model.md §3`.

export const ReporteCardSchema = z.object({
  title: z.string().min(1).max(80),
  period: z.string().min(1).max(80),
  kpis: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        value: z.string().min(1).max(40),
      })
    )
    .min(1)
    .max(6),
});

export const AlertaCardSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  suggestedAction: z.string().min(1).max(200),
});

// ISO date YYYY-MM-DD. Kept deliberately strict: Warden emits this as a
// plain calendar date (licence expiry), so any other shape is a bug in the
// tool output, not a valid card.
const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "licencia debe ser YYYY-MM-DD");

export const OperadorCardSchema = z.object({
  nombre: z.string().min(1).max(80),
  scoring: z.number().int().min(0).max(100),
  viajesActivos: z.number().int().min(0),
  licencia: IsoDateSchema,
  trend: z.enum(["up", "down", "stable"]),
});

export const CardTypeSchema = z.enum(["reporte", "alerta", "operador"]);
export type CardType = z.infer<typeof CardTypeSchema>;

// Discriminated union over `card_type` + its payload. The persistence layer
// stores the type in its own column and the payload as `jsonb`, but at the
// API boundary we validate them together so a mismatched pair (e.g.
// card_type='alerta' with a `reporte` payload) is rejected up-front.
export const CardSchema = z.discriminatedUnion("card_type", [
  z.object({ card_type: z.literal("reporte"), payload: ReporteCardSchema }),
  z.object({ card_type: z.literal("alerta"), payload: AlertaCardSchema }),
  z.object({ card_type: z.literal("operador"), payload: OperadorCardSchema }),
]);

export type ReporteCard = z.infer<typeof ReporteCardSchema>;
export type AlertaCard = z.infer<typeof AlertaCardSchema>;
export type OperadorCard = z.infer<typeof OperadorCardSchema>;
export type Card = z.infer<typeof CardSchema>;

// Per-type schema lookup — used by the tool executor when a tool returns
// a card payload and we need to validate against the declared type.
export const CARD_PAYLOAD_SCHEMAS: Record<CardType, z.ZodTypeAny> = {
  reporte: ReporteCardSchema,
  alerta: AlertaCardSchema,
  operador: OperadorCardSchema,
};

export function validateCardPayload(
  cardType: CardType,
  payload: unknown
): Card["payload"] {
  const schema = CARD_PAYLOAD_SCHEMAS[cardType];
  return schema.parse(payload) as Card["payload"];
}
