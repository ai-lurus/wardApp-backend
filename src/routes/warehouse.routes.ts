import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as warehouseService from "../services/warehouse.service";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";

const router = Router();

// Schemas para OpenAPI
const WarehouseConfigSchema = registry.register(
  "WarehouseConfig",
  z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    width_m: z.number().openapi({ example: 50 }),
    height_m: z.number().openapi({ example: 30 }),
  })
);

const WarehouseZoneSchema = registry.register(
  "WarehouseZone",
  z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    name: z.string().openapi({ example: "Zona A" }),
    description: z.string().nullable(),
    x_pct: z.number(),
    y_pct: z.number(),
    w_pct: z.number(),
    h_pct: z.number(),
    color: z.string().nullable(),
  })
);

// Documentación de rutas
router.use(authMiddleware);

// GET /api/warehouse/config
registry.registerPath({
  method: "get",
  path: "/warehouse/config",
  summary: "Obtener configuración del almacén",
  tags: ["Warehouse"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Configuración del almacén",
      content: { "application/json": { schema: WarehouseConfigSchema } },
    },
  },
});

// GET /api/warehouse/config
router.get(
  "/config",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await warehouseService.getOrCreateConfig(req.user!.companyId);
      res.json(config);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/warehouse/config
registry.registerPath({
  method: "put",
  path: "/warehouse/config",
  summary: "Actualizar configuración del almacén",
  tags: ["Warehouse"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            width_m: z.number().positive().optional(),
            height_m: z.number().positive().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Configuración actualizada",
      content: { "application/json": { schema: WarehouseConfigSchema } },
    },
  },
});
const updateConfigSchema = z.object({
  width_m: z.number().positive().optional(),
  height_m: z.number().positive().optional(),
});

router.put(
  "/config",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateConfigSchema.parse(req.body);
      const config = await warehouseService.updateConfig(req.user!.companyId, body);
      res.json(config);
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

// GET /api/warehouse/zones
registry.registerPath({
  method: "get",
  path: "/warehouse/zones",
  summary: "Listar zonas del almacén",
  tags: ["Warehouse"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Lista de zonas",
      content: { "application/json": { schema: z.array(WarehouseZoneSchema) } },
    },
  },
});
router.get(
  "/zones",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const zones = await warehouseService.listZones(req.user!.companyId);
      res.json(zones);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/warehouse/zones
registry.registerPath({
  method: "post",
  path: "/warehouse/zones",
  summary: "Crear una nueva zona",
  tags: ["Warehouse"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            x_pct: z.number().min(0).max(100),
            y_pct: z.number().min(0).max(100),
            w_pct: z.number().min(0).max(100),
            h_pct: z.number().min(0).max(100),
            color: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Zona creada",
      content: { "application/json": { schema: WarehouseZoneSchema } },
    },
  },
});
const createZoneSchema = z.object({
  name: z.string().min(1, "El nombre de la zona es requerido"),
  description: z.string().optional(),
  x_pct: z.number().min(0).max(100),
  y_pct: z.number().min(0).max(100),
  w_pct: z.number().min(0).max(100),
  h_pct: z.number().min(0).max(100),
  color: z.string().optional(),
});

router.post(
  "/zones",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createZoneSchema.parse(req.body);
      const zone = await warehouseService.createZone(req.user!.companyId, body);
      res.status(201).json(zone);
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

// PUT /api/warehouse/zones/:id
registry.registerPath({
  method: "put",
  path: "/warehouse/zones/{id}",
  summary: "Actualizar una zona",
  tags: ["Warehouse"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            description: z.string().optional(),
            x_pct: z.number().optional(),
            y_pct: z.number().optional(),
            w_pct: z.number().optional(),
            h_pct: z.number().optional(),
            color: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Zona actualizada",
      content: { "application/json": { schema: WarehouseZoneSchema } },
    },
  },
});
const updateZoneSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  x_pct: z.number().min(0).max(100).optional(),
  y_pct: z.number().min(0).max(100).optional(),
  w_pct: z.number().min(0).max(100).optional(),
  h_pct: z.number().min(0).max(100).optional(),
  color: z.string().optional(),
});

router.put(
  "/zones/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateZoneSchema.parse(req.body);
      const zone = await warehouseService.updateZone(req.params.id, req.user!.companyId, body);
      res.json(zone);
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

// DELETE /api/warehouse/zones/:id
registry.registerPath({
  method: "delete",
  path: "/warehouse/zones/{id}",
  summary: "Eliminar una zona",
  tags: ["Warehouse"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Zona eliminada",
      content: { "application/json": { schema: z.object({ message: z.string() }) } },
    },
  },
});
router.delete(
  "/zones/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await warehouseService.deleteZone(req.params.id, req.user!.companyId);
      res.json({ message: "Zone deleted" });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/warehouse/map
registry.registerPath({
  method: "get",
  path: "/warehouse/map",
  summary: "Obtener mapa completo del almacén (config + zonas)",
  tags: ["Warehouse"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Mapa del almacén",
      content: {
        "application/json": {
          schema: z.object({
            config: WarehouseConfigSchema,
            zones: z.array(WarehouseZoneSchema),
          }),
        },
      },
    },
  },
});
router.get(
  "/map",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const map = await warehouseService.getMap(req.user!.companyId);
      res.json(map);
    } catch (err) {
      next(err);
    }
  }
);

export { router as warehouseRoutes };
