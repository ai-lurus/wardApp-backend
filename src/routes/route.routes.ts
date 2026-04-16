import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as routeService from "../services/route.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("operaciones"));

const RouteTollboothSchema = registry.register(
  "RouteTollbooth",
  z.object({
    tollbooth_id: z.string().uuid(),
    order: z.number(),
    tollbooth: z.any().optional(), // Ideally referencing TollboothSchema but fine as any for preview
  })
);

const RouteSchema = registry.register(
  "Route",
  z.object({
    id: z.string().uuid().openapi({ example: "234e5678-e89b-12d3-a456-426614174000" }),
    name: z.string().openapi({ example: "Ruta 15D - CDMX a Puebla" }),
    origin: z.string().openapi({ example: "Ciudad de México" }),
    destination: z.string().openapi({ example: "Puebla" }),
    distance_km: z.number().openapi({ example: 130.5 }),
    estimated_duration_min: z.number().openapi({ example: 120 }),
    active: z.boolean().openapi({ example: true }),
    tollbooths: z.array(RouteTollboothSchema).optional(),
  })
);

const idParamSchema = z.object({
  id: z.string().uuid("El ID de la ruta no es un UUID válido"),
});

const getRoutesQuerySchema = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
  active: z
    .string()
    .optional()
    .transform((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }),
});

registry.registerPath({
  method: "get",
  path: "/routes",
  summary: "Listar rutas",
  tags: ["Routes"],
  security: [{ bearerAuth: [] }],
  request: {
    query: getRoutesQuerySchema,
  },
  responses: {
    200: {
      description: "Lista de rutas",
      content: {
        "application/json": {
          schema: z.array(RouteSchema),
        },
      },
    },
  },
});

const sanitizePivot = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  const { id, route_id, created_at, updated_at, ...rest } = obj;
  if (rest.tollbooth) {
    rest.tollbooth = sanitizeResult(rest.tollbooth);
  }
  return rest;
};

const sanitizeResult = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitizeResult);
  if (!obj || typeof obj !== "object") return obj;
  const { company_id, created_at, updated_at, route_tollbooths, ...rest } = obj;
  
  if (route_tollbooths) {
    rest.tollbooths = route_tollbooths.map(sanitizePivot);
  }
  
  return rest;
};

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = getRoutesQuerySchema.parse(req.query);
    const result = await routeService.getRoutes(req.user!.companyId, query);
    res.json({ success: true, data: sanitizeResult(result) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/routes/{id}",
  summary: "Obtener ruta por ID",
  tags: ["Routes"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Detalle de la ruta",
      content: {
        "application/json": { schema: RouteSchema },
      },
    },
    404: { description: "Ruta no encontrada" },
  },
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await routeService.getRouteById(req.user!.companyId, id);
    if (!result) {
      throw new AppError(404, "Ruta no encontrada");
    }
    res.json({ success: true, data: sanitizeResult(result) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

const routeTollboothInputSchema = z.object({
  tollbooth_id: z.string().uuid("ID de caseta inválido"),
  order: z.number().int().min(0, "El orden debe ser mayor o igual a 0"),
});

const createRouteSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  origin: z.string().min(1, "El origen es requerido"),
  destination: z.string().min(1, "El destino es requerido"),
  distance_km: z.number().min(0, "La distancia debe ser mayor a 0"),
  estimated_duration_min: z.number().int().min(0),
  active: z.boolean().optional(),
  tollbooths: z.array(routeTollboothInputSchema).default([]),
});

registry.registerPath({
  method: "post",
  path: "/routes",
  summary: "Crear una nueva ruta con casetas",
  tags: ["Routes"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createRouteSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Ruta creada con éxito",
      content: {
        "application/json": { schema: RouteSchema },
      },
    },
  },
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createRouteSchema.parse(req.body);
    const result = await routeService.createRoute(req.user!.companyId, body);
    res.status(201).json({ success: true, data: sanitizeResult(result) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

const updateRouteSchema = createRouteSchema.partial();

registry.registerPath({
  method: "put",
  path: "/routes/{id}",
  summary: "Actualizar una ruta existente",
  tags: ["Routes"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": { schema: updateRouteSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Ruta actualizada con éxito",
      content: {
        "application/json": { schema: RouteSchema },
      },
    },
  },
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateRouteSchema.parse(req.body);
    const result = await routeService.updateRoute(req.user!.companyId, id, body);
    if (!result) {
      throw new AppError(404, "Ruta no encontrada");
    }
    res.json({ success: true, data: sanitizeResult(result) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "delete",
  path: "/routes/{id}",
  summary: "Desactivar ruta (soft delete)",
  tags: ["Routes"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Ruta desactivada con éxito",
      content: {
        "application/json": { schema: RouteSchema },
      },
    },
  },
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await routeService.deleteRoute(req.user!.companyId, id);
    if (!result) {
      throw new AppError(404, "Ruta no encontrada");
    }
    res.json({ success: true, data: sanitizeResult(result) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

const costPreviewQuerySchema = z.object({
  axles: z.coerce.number().int().min(2).max(10).default(5),
});

registry.registerPath({
  method: "get",
  path: "/routes/{id}/cost-preview",
  summary: "Vista previa de costo de ruta por casetas",
  tags: ["Routes"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    query: costPreviewQuerySchema,
  },
  responses: {
    200: {
      description: "Costo total",
      content: {
        "application/json": {
          schema: z.object({
            route_id: z.string().uuid(),
            axles: z.number(),
            total_cost: z.number(),
            currency: z.string(),
          }),
        },
      },
    },
  },
});

router.get("/:id/cost-preview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { axles } = costPreviewQuerySchema.parse(req.query);
    
    // Check if ruta is active
    const route = await routeService.getRouteById(req.user!.companyId, id);
    if (!route) {
      throw new AppError(404, "Ruta no encontrada");
    }
    if (!route.active) {
      throw new AppError(400, "No se puede calcular costo en una ruta desactivada");
    }

    const result = await routeService.getRouteCostPreview(req.user!.companyId, id, axles);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

export { router as routeRoutes };
