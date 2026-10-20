import { z } from "zod";
import { register } from "./registry";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const StockPredictionsArgs = z.object({
  solo_criticos: z.boolean().default(false),
  nombre: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

register({
  name: "stock_predictions",
  module: "inventario",
  description:
    "Consulta el stock actual de materiales registrados en el sistema (incluye diésel, aceites, refacciones y cualquier insumo). Usa `nombre` para buscar un material específico por nombre parcial. Detecta también materiales en riesgo de agotarse.",
  argsSchema: StockPredictionsArgs,
  inputSchema: {
    type: "object",
    properties: {
      nombre: {
        type: "string",
        description:
          "Filtro parcial por nombre de material (ej. 'diesel', 'aceite', 'llanta'). Omitir para ver todos.",
      },
      solo_criticos: {
        type: "boolean",
        description:
          "Si es true, solo devuelve materiales cuyo stock actual está por debajo del mínimo.",
      },
      limit: {
        type: "number",
        description: "Máximo de materiales a devolver (1-50).",
      },
    },
  },
  handler: async (tx, args, ctx) => {
    const parsed = StockPredictionsArgs.parse(args);

    const materials = await tx.material.findMany({
      where: {
        company_id: ctx.companyId,
        active: true,
        ...(parsed.nombre
          ? { name: { contains: parsed.nombre, mode: "insensitive" } }
          : {}),
      },
      take: parsed.limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        current_stock: true,
        min_stock: true,
        reference_price: true,
        category: { select: { name: true } },
      },
    });

    const estado = (m: { current_stock: number; min_stock: number }) =>
      m.current_stock === 0
        ? "agotado"
        : m.current_stock < m.min_stock
          ? "critico"
          : m.current_stock < m.min_stock * 1.2
            ? "bajo"
            : "ok";

    // When a single specific material is found, enrich with movement history.
    if (materials.length === 1 && parsed.nombre) {
      const m = materials[0];
      const since = new Date(Date.now() - THIRTY_DAYS_MS);

      const [exits, lastEntry] = await Promise.all([
        tx.inventoryMovement.aggregate({
          where: {
            company_id: ctx.companyId,
            material_id: m.id,
            type: "exit",
            movement_date: { gte: since },
          },
          _sum: { quantity: true },
        }),
        tx.inventoryMovement.findFirst({
          where: {
            company_id: ctx.companyId,
            material_id: m.id,
            type: "entry",
          },
          orderBy: { movement_date: "desc" },
          select: { movement_date: true },
        }),
      ]);

      const totalSalidas = exits._sum.quantity ?? 0;
      const consumoDiario = totalSalidas > 0 ? totalSalidas / 30 : null;
      const diasCobertura =
        consumoDiario && consumoDiario > 0
          ? Math.floor(m.current_stock / consumoDiario)
          : null;
      const ultimaEntradaDias = lastEntry
        ? Math.floor(
            (Date.now() - new Date(lastEntry.movement_date).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : null;

      const estadoVal = estado(m) as "ok" | "bajo" | "critico" | "agotado";

      return {
        data: {
          total: 1,
          criticos: estadoVal === "agotado" || estadoVal === "critico" ? 1 : 0,
          materiales: [
            {
              nombre: m.name,
              sku: m.sku,
              unidad: m.unit,
              stock_actual: m.current_stock,
              stock_minimo: m.min_stock,
              estado: estadoVal,
              consumo_diario_promedio: consumoDiario,
              dias_cobertura: diasCobertura,
              ultima_entrada_dias: ultimaEntradaDias,
            },
          ],
        },
        card: {
          card_type: "material" as const,
          payload: {
            nombre: m.name,
            sku: m.sku ?? null,
            unidad: m.unit,
            stock_actual: m.current_stock,
            stock_minimo: m.min_stock,
            estado: estadoVal,
            valor_estimado:
              m.reference_price != null
                ? `$${(m.reference_price * m.current_stock).toLocaleString("es-MX")}`
                : null,
            consumo_diario_promedio: consumoDiario
              ? Math.round(consumoDiario * 10) / 10
              : null,
            dias_cobertura: diasCobertura,
            ultima_entrada_dias: ultimaEntradaDias,
          },
        },
      };
    }

    // Multiple materials — enrich without extra queries.
    const enriched = materials.map((m) => {
      const deficit = m.min_stock - m.current_stock;
      return {
        nombre: m.name,
        sku: m.sku,
        categoria: m.category.name,
        unidad: m.unit,
        stock_actual: m.current_stock,
        stock_minimo: m.min_stock,
        deficit: deficit > 0 ? deficit : 0,
        estado: estado(m),
        valor_estimado:
          m.reference_price != null
            ? (m.reference_price * m.current_stock).toFixed(2)
            : null,
      };
    });

    const filtered = parsed.solo_criticos
      ? enriched.filter((m) => m.estado === "agotado" || m.estado === "critico")
      : enriched;

    const criticos = filtered.filter(
      (m) => m.estado === "agotado" || m.estado === "critico"
    );

    const card =
      criticos.length > 0
        ? {
            card_type: "alerta" as const,
            payload: {
              severity: criticos.some((m) => m.estado === "agotado")
                ? "critical"
                : "warning",
              title: `${criticos.length} material${criticos.length !== 1 ? "es" : ""} con stock crítico`,
              description: criticos
                .slice(0, 3)
                .map((m) => `${m.nombre}: ${m.stock_actual}/${m.stock_minimo} ${m.unidad}`)
                .join(" | "),
              suggestedAction: "Generar orden de reabastecimiento.",
            },
          }
        : undefined;

    return {
      data: {
        total: filtered.length,
        criticos: criticos.length,
        materiales: filtered,
      },
      card,
    };
  },
});
