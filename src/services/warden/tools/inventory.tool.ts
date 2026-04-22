import { z } from "zod";
import { register } from "./registry";

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
        estado:
          m.current_stock === 0
            ? "agotado"
            : m.current_stock < m.min_stock
              ? "critico"
              : m.current_stock < m.min_stock * 1.2
                ? "bajo"
                : "ok",
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
