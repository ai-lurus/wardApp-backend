import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as tollboothService from "../services/tollbooth.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("operaciones"));

const TollboothSchema = registry.register(
  "Tollbooth",
  z.object({
    id: z.string().uuid().openapi({ example: "123e4567-e89b-12d3-a456-426614174000" }),
    name: z.string().openapi({ example: "Caseta San Martín" }),
    cost_2_axles: z.number().openapi({ example: 150.5 }),
    cost_3_axles: z.number().openapi({ example: 200.0 }),
    cost_4_axles: z.number().openapi({ example: 250.0 }),
    cost_5_axles: z.number().openapi({ example: 300.0 }),
    cost_6_axles: z.number().openapi({ example: 350.0 }),
    cost_7_plus_axles: z.number().openapi({ example: 400.0 }),
    active: z.boolean().openapi({ example: true }),
  })
);

const idParamSchema = z.object({
  id: z.string().uuid("El ID de la caseta no es un UUID válido"),
});

const getTollboothsQuerySchema = z.object({
  search: z.string().optional(),
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
  path: "/tollbooths",
  summary: "Listar casetas",
  tags: ["Tollbooths"],
  security: [{ bearerAuth: [] }],
  request: {
    query: getTollboothsQuerySchema.extend({
      search: z.string().optional().openapi({ description: "Búsqueda por nombre de caseta" }),
    }),
  },
  responses: {
    200: {
      description: "Lista de casetas",
      content: {
        "application/json": {
          schema: z.array(TollboothSchema),
        },
      },
    },
  },
});

const sanitizeResult = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitizeResult);
  if (!obj || typeof obj !== "object") return obj;
  const { company_id, created_at, updated_at, ...rest } = obj;
  return rest;
};

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = getTollboothsQuerySchema.parse(req.query);
    const result = await tollboothService.getTollbooths(req.user!.companyId, query);
    res.json(sanitizeResult(result));
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
  path: "/tollbooths/{id}",
  summary: "Obtener caseta por ID",
  tags: ["Tollbooths"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Detalle de la caseta",
      content: {
        "application/json": { schema: TollboothSchema },
      },
    },
    404: { description: "Caseta no encontrada" },
  },
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await tollboothService.getTollboothById(req.user!.companyId, id);
    if (!result) {
      throw new AppError(404, "Caseta no encontrada");
    }
    res.json(sanitizeResult(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

const createTollboothSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  cost_2_axles: z.number().min(0, "El costo debe ser mayor o igual a 0"),
  cost_3_axles: z.number().min(0),
  cost_4_axles: z.number().min(0),
  cost_5_axles: z.number().min(0),
  cost_6_axles: z.number().min(0),
  cost_7_plus_axles: z.number().min(0),
  active: z.boolean().optional(),
});

registry.registerPath({
  method: "post",
  path: "/tollbooths",
  summary: "Crear una nueva caseta",
  tags: ["Tollbooths"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createTollboothSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Caseta creada con éxito",
      content: {
        "application/json": { schema: TollboothSchema },
      },
    },
  },
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTollboothSchema.parse(req.body);
    const result = await tollboothService.createTollbooth(req.user!.companyId, body);
    res.status(201).json(sanitizeResult(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

const updateTollboothSchema = createTollboothSchema.partial();

registry.registerPath({
  method: "put",
  path: "/tollbooths/{id}",
  summary: "Actualizar una caseta existente",
  tags: ["Tollbooths"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": { schema: updateTollboothSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Caseta actualizada con éxito",
      content: {
        "application/json": { schema: TollboothSchema },
      },
    },
  },
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateTollboothSchema.parse(req.body);
    const result = await tollboothService.updateTollbooth(req.user!.companyId, id, body);
    if (!result) {
      throw new AppError(404, "Caseta no encontrada");
    }
    res.json(sanitizeResult(result));
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
  path: "/tollbooths/{id}",
  summary: "Desactivar caseta (soft delete)",
  tags: ["Tollbooths"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Caseta desactivada con éxito",
      content: {
        "application/json": { schema: TollboothSchema },
      },
    },
  },
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await tollboothService.deleteTollbooth(req.user!.companyId, id);
    if (!result) {
      throw new AppError(404, "Caseta no encontrada");
    }
    res.json(sanitizeResult(result));
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
    } else {
      next(err);
    }
  }
});

export { router as tollboothRoutes };
