import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { MovementType } from "@prisma/client";
import * as inventoryService from "../services/inventory.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("inventario"));

// Schemas para OpenAPI
const MovementTypeEnum = z.nativeEnum(MovementType).openapi("MovementType");

const MovementSchema = registry.register(
  "Movement",
  z.object({
    id: z.string().uuid(),
    material_id: z.string().uuid(),
    type: MovementTypeEnum,
    quantity: z.number().int(),
    unit_cost: z.number().nullable(),
    supplier: z.string().nullable(),
    invoice_number: z.string().nullable(),
    destination: z.string().nullable(),
    reason: z.string().nullable(),
    notes: z.string().nullable(),
    created_by: z.string().uuid(),
    company_id: z.string().uuid(),
    createdAt: z.date(),
  })
);

// Documentación de rutas
registry.registerPath({
  method: "post",
  path: "/inventory/entry",
  summary: "Registrar entrada de material (Compra/Donación/etc)",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            material_id: z.string().uuid(),
            quantity: z.number().int().positive(),
            unit_cost: z.number().positive().optional(),
            supplier: z.string().optional(),
            invoice_number: z.string().optional(),
            notes: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Entrada registrada",
      content: { "application/json": { schema: MovementSchema } },
    },
  },
});

// POST /api/inventory/entry
const entrySchema = z.object({
  material_id: z.string().uuid().min(1, "El ID del material es requerido"),
  quantity: z.number().int().positive().min(1, "La cantidad debe ser mayor a 0"),
  unit_cost: z.number().positive().optional(),
  supplier: z.string().optional(),
  invoice_number: z.string().optional(),
  notes: z.string().optional(),
});

router.post(
  "/entry",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = entrySchema.parse(req.body);
      const movement = await inventoryService.registerEntry({
        companyId: req.user!.companyId,
        ...body,
        created_by: req.user!.userId,
      });
      res.status(201).json(movement);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

registry.registerPath({
  method: "post",
  path: "/inventory/exit",
  summary: "Registrar salida de material (Uso/Mantenimiento/etc)",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            material_id: z.string().uuid(),
            quantity: z.number().int().positive(),
            destination: z.string().optional(),
            reason: z.string().optional(),
            notes: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Salida registrada",
      content: { "application/json": { schema: MovementSchema } },
    },
  },
});

// POST /api/inventory/exit
const exitSchema = z.object({
  material_id: z.string().uuid().min(1, "El ID del material es requerido"),
  quantity: z.number().int().positive().min(1, "La cantidad debe ser mayor a 0"),
  destination: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

router.post(
  "/exit",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = exitSchema.parse(req.body);
      const movement = await inventoryService.registerExit({
        companyId: req.user!.companyId,
        ...body,
        created_by: req.user!.userId,
      });
      res.status(201).json(movement);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

registry.registerPath({
  method: "get",
  path: "/inventory/movements",
  summary: "Listar historial de movimientos",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      type: MovementTypeEnum.optional(),
      material_id: z.string().uuid().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Historial de movimientos paginado",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(MovementSchema),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
            }),
          }),
        },
      },
    },
  },
});

// GET /api/inventory/movements
router.get(
  "/movements",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, material_id, page, limit } = req.query;
      const result = await inventoryService.listMovements({
        companyId: req.user!.companyId,
        type: type as MovementType | undefined,
        material_id: material_id as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

registry.registerPath({
  method: "get",
  path: "/inventory/stock",
  summary: "Obtener estado actual del inventario",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      low_stock: z.string().optional().openapi({ description: "Filtrar solo stock bajo" }),
    }),
  },
  responses: {
    200: {
      description: "Estado del stock",
      content: {
        "application/json": {
          schema: z.array(z.object({
            id: z.string().uuid(),
            name: z.string(),
            current_stock: z.number(),
            min_stock: z.number(),
            unit: z.string().nullable(),
          })),
        },
      },
    },
  },
});

// GET /api/inventory/stock
router.get(
  "/stock",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lowStock = req.query.low_stock === "true";
      const stock = await inventoryService.getStock(req.user!.companyId, lowStock);
      res.json(stock);
    } catch (err) {
      next(err);
    }
  }
);

registry.registerPath({
  method: "get",
  path: "/inventory/alerts",
  summary: "Obtener alertas activas de inventario",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Lista de alertas",
      content: {
        "application/json": {
          schema: z.array(z.object({
            type: z.string(),
            message: z.string(),
            material_id: z.string().uuid().optional(),
          })),
        },
      },
    },
  },
});

// GET /api/inventory/alerts
router.get(
  "/alerts",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alerts = await inventoryService.getAlerts(req.user!.companyId);
      res.json(alerts);
    } catch (err) {
      next(err);
    }
  }
);

export { router as inventoryRoutes };
