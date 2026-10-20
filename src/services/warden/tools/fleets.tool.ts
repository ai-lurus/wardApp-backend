import { z } from "zod";
import { register } from "./registry";

const ListUnitHealthArgs = z.object({
  status: z
    .enum(["disponible", "en_viaje", "mantenimiento", "inactivo", "todos"])
    .default("todos"),
  limit: z.number().int().min(1).max(50).default(20),
});

register({
  name: "list_unit_health",
  module: "flotas",
  description:
    "Lista el estado operativo de las unidades de la flota. Filtra por status (disponible, en_viaje, mantenimiento, inactivo) o devuelve todas.",
  argsSchema: ListUnitHealthArgs,
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["disponible", "en_viaje", "mantenimiento", "inactivo", "todos"],
        description: "Estado de la unidad a filtrar. Usa 'todos' para ver todas.",
      },
      limit: {
        type: "number",
        description: "Máximo de unidades a devolver (1-50).",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = ListUnitHealthArgs.parse(args);
    const where =
      parsed.status === "todos"
        ? { company_id: ctx.companyId }
        : { company_id: ctx.companyId, status: parsed.status as "disponible" | "en_viaje" | "mantenimiento" | "inactivo" };

    const units = await tx.unit.findMany({
      where,
      take: parsed.limit,
      orderBy: { updated_at: "desc" },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        type: true,
        status: true,
        insurance_expiry: true,
        last_maintenance_date: true,
        fuel_efficiency_km_l: true,
      },
    });

    const summary = {
      total: units.length,
      por_status: units.reduce(
        (acc, u) => {
          acc[u.status] = (acc[u.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      unidades: units.map((u) => ({
        placa: u.plate,
        marca: u.brand,
        modelo: u.model,
        tipo: u.type,
        status: u.status,
        seguro_vence: u.insurance_expiry?.toISOString().split("T")[0] ?? null,
        ultimo_mantenimiento:
          u.last_maintenance_date?.toISOString().split("T")[0] ?? null,
        eficiencia_km_l: u.fuel_efficiency_km_l?.toString() ?? null,
      })),
    };

    const enMantenimiento = units.filter((u) => u.status === "mantenimiento").length;
    const card =
      enMantenimiento > 0
        ? {
            card_type: "reporte" as const,
            payload: {
              title: "Estado de Flota",
              period: new Date().toLocaleDateString("es-MX"),
              kpis: [
                { label: "Total unidades", value: String(units.length) },
                {
                  label: "Disponibles",
                  value: String(summary.por_status["disponible"] ?? 0),
                },
                { label: "En viaje", value: String(summary.por_status["en_viaje"] ?? 0) },
                { label: "Mantenimiento", value: String(enMantenimiento) },
              ],
            },
          }
        : undefined;

    return { data: summary, card };
  },
});

const ListFleetAlertsArgs = z.object({
  dias_anticipacion: z.number().int().min(1).max(90).default(30),
});

register({
  name: "list_fleet_alerts",
  module: "flotas",
  description:
    "Lista alertas de la flota: seguros próximos a vencer, mantenimientos pendientes, y unidades inactivas.",
  argsSchema: ListFleetAlertsArgs,
  inputSchema: {
    type: "object",
    properties: {
      dias_anticipacion: {
        type: "number",
        description:
          "Días de anticipación para considerar un seguro 'próximo a vencer' (default: 30).",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = ListFleetAlertsArgs.parse(args);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + parsed.dias_anticipacion);

    const units = await tx.unit.findMany({
      where: { company_id: ctx.companyId },
      select: {
        plate: true,
        brand: true,
        status: true,
        insurance_expiry: true,
        last_maintenance_date: true,
      },
    });

    const alerts: Array<{
      tipo: string;
      placa: string;
      detalle: string;
      severidad: "warning" | "critical";
    }> = [];

    for (const u of units) {
      if (u.insurance_expiry && u.insurance_expiry <= cutoff) {
        const daysLeft = Math.ceil(
          (u.insurance_expiry.getTime() - Date.now()) / 86400000
        );
        alerts.push({
          tipo: "seguro",
          placa: u.plate,
          detalle: `Seguro vence en ${daysLeft} días (${u.insurance_expiry.toISOString().split("T")[0]})`,
          severidad: daysLeft <= 7 ? "critical" : "warning",
        });
      }
      if (u.status === "inactivo") {
        alerts.push({
          tipo: "inactividad",
          placa: u.plate,
          detalle: "Unidad marcada como inactiva",
          severidad: "warning",
        });
      }
    }

    const card =
      alerts.length > 0
        ? {
            card_type: "alerta" as const,
            payload: {
              severity: alerts.some((a) => a.severidad === "critical")
                ? "critical"
                : "warning",
              title: `${alerts.length} alerta${alerts.length !== 1 ? "s" : ""} de flota`,
              description: alerts
                .slice(0, 3)
                .map((a) => `${a.placa}: ${a.detalle}`)
                .join(" | "),
              suggestedAction:
                "Revisar seguros y programar mantenimientos pendientes.",
            },
          }
        : undefined;

    return { data: { total_alertas: alerts.length, alertas: alerts }, card };
  },
});
