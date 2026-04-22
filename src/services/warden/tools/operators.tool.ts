import { z } from "zod";
import { register } from "./registry";

const OperatorScoringArgs = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  solo_activos: z.boolean().default(true),
});

register({
  name: "operator_scoring",
  module: "operaciones",
  description:
    "Lista operadores/usuarios activos de la empresa con su actividad en el sistema. Útil para evaluar participación y actividad.",
  argsSchema: OperatorScoringArgs,
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Máximo de operadores a devolver.",
      },
      solo_activos: {
        type: "boolean",
        description: "Si es true (default), solo incluye usuarios activos.",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = OperatorScoringArgs.parse(args);

    const users = await tx.user.findMany({
      where: parsed.solo_activos ? { company_id: ctx.companyId, active: true } : { company_id: ctx.companyId },
      take: parsed.limit,
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        created_at: true,
        _count: { select: { movements: true } },
      },
    });

    const result = users.map((u) => ({
      nombre: u.name,
      rol: u.role,
      activo: u.active,
      movimientos_realizados: u._count.movements,
      miembro_desde: u.created_at.toISOString().split("T")[0],
    }));

    const card =
      result.length > 0
        ? {
            card_type: "reporte" as const,
            payload: {
              title: "Actividad de Operadores",
              period: new Date().toLocaleDateString("es-MX"),
              kpis: [
                { label: "Total operadores", value: String(result.length) },
                {
                  label: "Activos",
                  value: String(result.filter((u) => u.activo).length),
                },
                {
                  label: "Total movimientos",
                  value: String(
                    result.reduce((s, u) => s + u.movimientos_realizados, 0)
                  ),
                },
              ],
            },
          }
        : undefined;

    return { data: { total: result.length, operadores: result }, card };
  },
});

const OperatorProfileArgs = z.object({
  user_id: z.string().uuid(),
});

register({
  name: "operator_profile",
  module: "operaciones",
  description: "Devuelve el perfil detallado de un operador específico incluyendo su actividad.",
  argsSchema: OperatorProfileArgs,
  inputSchema: {
    type: "object",
    properties: {
      user_id: {
        type: "string",
        description: "UUID del operador a consultar.",
      },
    },
    required: ["user_id"],
  },
  handler: async (tx, args, ctx) => {
    const parsed = OperatorProfileArgs.parse(args);

    const user = await tx.user.findFirst({
      where: { id: parsed.user_id, company_id: ctx.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        created_at: true,
        _count: { select: { movements: true } },
      },
    });

    if (!user) {
      return {
        data: { error: "Operador no encontrado en esta empresa." },
      };
    }

    const recentMovements = await tx.inventoryMovement.findMany({
      where: { created_by: user.id },
      take: 5,
      orderBy: { created_at: "desc" },
      select: {
        type: true,
        quantity: true,
        movement_date: true,
        material: { select: { name: true } },
      },
    });

    const profile = {
      nombre: user.name,
      rol: user.role,
      activo: user.active,
      miembro_desde: user.created_at.toISOString().split("T")[0],
      total_movimientos: user._count.movements,
      ultimos_movimientos: recentMovements.map((m) => ({
        tipo: m.type,
        cantidad: m.quantity,
        material: m.material.name,
        fecha: m.movement_date.toISOString().split("T")[0],
      })),
    };

    const card = {
      card_type: "operador" as const,
      payload: {
        nombre: user.name,
        scoring: Math.min(100, user._count.movements * 5),
        viajesActivos: 0,
        licencia: null,
        trend: (user._count.movements > 10 ? "up" : "stable") as "up" | "down" | "stable",
      },
    };

    return { data: profile, card };
  },
});
