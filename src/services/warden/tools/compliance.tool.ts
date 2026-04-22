import { z } from "zod";
import { register } from "./registry";

const ExpiringPermitsArgs = z.object({
  dias_anticipacion: z.number().int().min(1).max(365).default(60),
});

register({
  name: "expiring_permits",
  module: "operaciones",
  description:
    "Lista unidades cuyo seguro vence en los próximos N días. Esencial para cumplimiento normativo.",
  argsSchema: ExpiringPermitsArgs,
  inputSchema: {
    type: "object",
    properties: {
      dias_anticipacion: {
        type: "number",
        description: "Días de anticipación para la alerta (default: 60).",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = ExpiringPermitsArgs.parse(args);
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() + parsed.dias_anticipacion);

    const units = await tx.unit.findMany({
      where: {
        company_id: ctx.companyId,
        insurance_expiry: { lte: cutoff },
      },
      orderBy: { insurance_expiry: "asc" },
      select: { plate: true, brand: true, model: true, type: true, insurance_expiry: true },
    });

    const result = units.map((u) => {
      const daysLeft = Math.ceil(
        ((u.insurance_expiry?.getTime() ?? 0) - now.getTime()) / 86400000
      );
      return {
        placa: u.plate,
        marca: u.brand,
        modelo: u.model,
        tipo: u.type,
        seguro_vence: u.insurance_expiry?.toISOString().split("T")[0] ?? null,
        dias_restantes: daysLeft,
        vencido: daysLeft < 0,
      };
    });

    const vencidos = result.filter((u) => u.vencido);
    const proximos = result.filter((u) => !u.vencido);

    const card =
      result.length > 0
        ? {
            card_type: "alerta" as const,
            payload: {
              severity: vencidos.length > 0 ? "critical" : "warning",
              title:
                vencidos.length > 0
                  ? `${vencidos.length} seguro${vencidos.length !== 1 ? "s" : ""} vencido${vencidos.length !== 1 ? "s" : ""}`
                  : `${proximos.length} seguro${proximos.length !== 1 ? "s" : ""} próximo${proximos.length !== 1 ? "s" : ""} a vencer`,
              description: result
                .slice(0, 3)
                .map(
                  (u) =>
                    `${u.placa}: ${u.vencido ? "VENCIDO" : `vence en ${u.dias_restantes} días`}`
                )
                .join(" | "),
              suggestedAction: "Renovar seguros antes de la fecha de vencimiento.",
            },
          }
        : undefined;

    return {
      data: { total: result.length, vencidos: vencidos.length, unidades: result },
      card,
    };
  },
});

const ExpiringVerificationsArgs = z.object({
  dias_anticipacion: z.number().int().min(1).max(365).default(30),
});

register({
  name: "expiring_verifications",
  module: "operaciones",
  description:
    "Lista unidades sin mantenimiento reciente o con mantenimiento vencido según el período estándar de 90 días.",
  argsSchema: ExpiringVerificationsArgs,
  inputSchema: {
    type: "object",
    properties: {
      dias_anticipacion: {
        type: "number",
        description: "Días sin mantenimiento para considerar una unidad en alerta (default: 30).",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = ExpiringVerificationsArgs.parse(args);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - (90 - parsed.dias_anticipacion));

    const units = await tx.unit.findMany({
      where: {
        company_id: ctx.companyId,
        OR: [
          { last_maintenance_date: null },
          { last_maintenance_date: { lte: threshold } },
        ],
      },
      orderBy: { last_maintenance_date: "asc" },
      select: {
        plate: true,
        brand: true,
        type: true,
        status: true,
        last_maintenance_date: true,
      },
    });

    const now = Date.now();
    const result = units.map((u) => {
      const daysSince = u.last_maintenance_date
        ? Math.floor((now - u.last_maintenance_date.getTime()) / 86400000)
        : null;
      return {
        placa: u.plate,
        marca: u.brand,
        tipo: u.type,
        status: u.status,
        ultimo_mantenimiento:
          u.last_maintenance_date?.toISOString().split("T")[0] ?? "Sin registro",
        dias_sin_mantenimiento: daysSince,
      };
    });

    const card =
      result.length > 0
        ? {
            card_type: "alerta" as const,
            payload: {
              severity: "warning",
              title: `${result.length} unidad${result.length !== 1 ? "es" : ""} requiere${result.length !== 1 ? "n" : ""} revisión`,
              description: result
                .slice(0, 3)
                .map(
                  (u) =>
                    `${u.placa}: ${u.dias_sin_mantenimiento != null ? `${u.dias_sin_mantenimiento} días sin mant.` : "sin registro"}`
                )
                .join(" | "),
              suggestedAction: "Programar mantenimientos preventivos.",
            },
          }
        : undefined;

    return { data: { total: result.length, unidades: result }, card };
  },
});
