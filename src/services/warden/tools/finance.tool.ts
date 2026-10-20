import { z } from "zod";
import { register } from "./registry";

const ListDieselAnomaliesArgs = z.object({
  dias: z.number().int().min(1).max(90).default(7),
  umbral_desviacion: z.number().min(0.05).max(1).default(0.2),
});

register({
  name: "list_diesel_anomalies",
  module: "finanzas",
  description:
    "Detecta consumos anómalos de diésel en movimientos de inventario. Compara costo promedio histórico contra movimientos recientes.",
  argsSchema: ListDieselAnomaliesArgs,
  inputSchema: {
    type: "object",
    properties: {
      dias: {
        type: "number",
        description: "Días hacia atrás para analizar (1-90, default 7).",
      },
      umbral_desviacion: {
        type: "number",
        description:
          "Fracción de desviación del costo promedio para marcar anomalía (ej. 0.2 = 20%).",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = ListDieselAnomaliesArgs.parse(args);
    const since = new Date();
    since.setDate(since.getDate() - parsed.dias);

    const dieselMaterials = await tx.material.findMany({
      where: {
        company_id: ctx.companyId,
        name: { contains: "diesel", mode: "insensitive" },
        active: true,
      },
      select: { id: true, name: true },
    });

    if (dieselMaterials.length === 0) {
      return {
        data: {
          mensaje: "No se encontraron materiales de diésel en el inventario.",
          anomalias: [],
        },
      };
    }

    const materialIds = dieselMaterials.map((m) => m.id);

    const allMovements = await tx.inventoryMovement.findMany({
      where: { company_id: ctx.companyId, material_id: { in: materialIds }, unit_cost: { not: null } },
      select: { material_id: true, unit_cost: true, movement_date: true, quantity: true },
      orderBy: { movement_date: "asc" },
    });

    const byMaterial: Record<
      string,
      Array<{ unit_cost: number; movement_date: Date; quantity: number; recent: boolean }>
    > = {};

    for (const m of allMovements) {
      if (!byMaterial[m.material_id]) byMaterial[m.material_id] = [];
      byMaterial[m.material_id].push({
        unit_cost: m.unit_cost!,
        movement_date: m.movement_date,
        quantity: m.quantity,
        recent: m.movement_date >= since,
      });
    }

    const anomalies: Array<{
      material: string;
      costo_promedio: number;
      costo_reciente: number;
      desviacion_pct: number;
      movimientos_recientes: number;
    }> = [];

    for (const mat of dieselMaterials) {
      const movements = byMaterial[mat.id] ?? [];
      const historical = movements.filter((m) => !m.recent);
      const recent = movements.filter((m) => m.recent);

      if (historical.length === 0 || recent.length === 0) continue;

      const avgHistorical =
        historical.reduce((s, m) => s + m.unit_cost, 0) / historical.length;
      const avgRecent =
        recent.reduce((s, m) => s + m.unit_cost, 0) / recent.length;
      const deviation = Math.abs(avgRecent - avgHistorical) / avgHistorical;

      if (deviation >= parsed.umbral_desviacion) {
        anomalies.push({
          material: mat.name,
          costo_promedio: Math.round(avgHistorical * 100) / 100,
          costo_reciente: Math.round(avgRecent * 100) / 100,
          desviacion_pct: Math.round(deviation * 1000) / 10,
          movimientos_recientes: recent.length,
        });
      }
    }

    const card =
      anomalies.length > 0
        ? {
            card_type: "alerta" as const,
            payload: {
              severity: "warning",
              title: `${anomalies.length} anomalía${anomalies.length !== 1 ? "s" : ""} de consumo diésel`,
              description: anomalies
                .slice(0, 2)
                .map(
                  (a) =>
                    `${a.material}: +${a.desviacion_pct}% vs histórico`
                )
                .join(" | "),
              suggestedAction:
                "Revisar facturas y comparar con precios del mercado.",
            },
          }
        : undefined;

    return {
      data: { total_anomalias: anomalies.length, periodo_dias: parsed.dias, anomalias },
      card,
    };
  },
});

const TripCostBreakdownArgs = z.object({
  route_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

register({
  name: "trip_cost_breakdown",
  module: "finanzas",
  description:
    "Muestra el desglose de costos por ruta: distancia, duración estimada y casetas.",
  argsSchema: TripCostBreakdownArgs,
  inputSchema: {
    type: "object",
    properties: {
      route_id: {
        type: "string",
        description: "UUID de una ruta específica. Omitir para listar todas.",
      },
      limit: {
        type: "number",
        description: "Máximo de rutas a devolver.",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = TripCostBreakdownArgs.parse(args);

    const routes = await tx.route.findMany({
      where: {
        company_id: ctx.companyId,
        active: true,
        ...(parsed.route_id ? { id: parsed.route_id } : {}),
      },
      take: parsed.limit,
      include: {
        route_tollbooths: {
          include: { tollbooth: { select: { name: true, cost: true } } },
          orderBy: { order: "asc" },
        },
      },
    });

    const result = routes.map((r) => {
      const totalCasetas = r.route_tollbooths.reduce(
        (s, rt) => s + (rt.tollbooth.cost ?? 0),
        0
      );
      return {
        id: r.id,
        nombre: r.name,
        origen: r.origin,
        destino: r.destination,
        distancia_km: r.distance_km,
        duracion_estimada_min: r.estimated_duration_min,
        casetas: r.route_tollbooths.map((rt) => ({
          nombre: rt.tollbooth.name,
          costo: rt.tollbooth.cost,
        })),
        total_casetas: totalCasetas,
      };
    });

    const card =
      result.length > 0
        ? {
            card_type: "reporte" as const,
            payload: {
              title: "Desglose de Costos por Ruta",
              period: new Date().toLocaleDateString("es-MX"),
              kpis: [
                { label: "Rutas activas", value: String(result.length) },
                {
                  label: "Costo promedio casetas",
                  value: `$${(result.reduce((s, r) => s + r.total_casetas, 0) / result.length).toFixed(0)}`,
                },
              ],
            },
          }
        : undefined;

    return { data: { total_rutas: result.length, rutas: result }, card };
  },
});
