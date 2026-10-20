import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as unitService from "../services/unit.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { UnitStatus, UnitType } from "@prisma/client";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("flotas"));

// Schemas para OpenAPI
const unitTypeEnum = z
  .enum(UnitType, {
    error: () => ({ message: "El tipo de unidad no es válido" }),
  })
  .openapi("UnitType");

const unitStatusEnum = z
  .enum(UnitStatus, {
    error: () => ({ message: "El tipo de estatus no es válido" }),
  })
  .openapi("UnitStatus");

const UnitSchema = registry.register(
  "Unit",
  z.object({
    id: z
      .string()
      .uuid()
      .openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    plate: z.string().openapi({ example: "ABC-1234" }),
    brand: z.string().nullable().openapi({ example: "Kenworth" }),
    model: z.string().nullable().openapi({ example: "T680" }),
    year: z.number().nullable().openapi({ example: 2024 }),
    type: unitTypeEnum,
    axles: z.number().openapi({ example: 3 }),
    status: unitStatusEnum,
    vin: z.string().nullable().openapi({ example: "1HB5222X8CXXXXXXX" }),
    insurance_expiry: z.date().nullable(),
    fuel_efficiency_km_l: z.number().nullable(),
    last_maintenance_date: z.date().nullable(),
    notes: z.string().nullable(),
    company_id: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
);

const idParamSchema = z.object({
  id: z.string().uuid("El ID de la unidad no es un UUID válido"),
});

// Documentación de rutas
registry.registerPath({
  method: "get",
  path: "/units/alerts/insurance",
  summary: "Alertas de vencimiento de seguro",
  tags: ["Units"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Lista de unidades con seguro próximo a vencer",
      content: {
        "application/json": {
          schema: z.array(UnitSchema),
        },
      },
    },
  },
});

// GET /api/units/alerts/insurance
router.get(
  "/alerts/insurance",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const units = await unitService.getInsuranceAlerts(req.user!.companyId);
      res.json(units);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/units
const getUnitsQuerySchema = z.object({
  status: unitStatusEnum.optional(),
  type: unitTypeEnum.optional(),
  available_only: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

registry.registerPath({
  method: "get",
  path: "/units",
  summary: "Listar unidades",
  tags: ["Units"],
  security: [{ bearerAuth: [] }],
  request: {
    query: getUnitsQuerySchema,
  },
  responses: {
    200: {
      description: "Lista de unidades",
      content: {
        "application/json": {
          schema: z.array(UnitSchema),
        },
      },
    },
  },
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type, available_only } = getUnitsQuerySchema.parse(
      req.query,
    );
    const units = await unitService.getUnits(req.user!.companyId, {
      status,
      type,
      available_only: available_only,
    });
    res.json(units);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/units/{id}",
  summary: "Obtener unidad por ID",
  tags: ["Units"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Detalle de la unidad",
      content: {
        "application/json": {
          schema: UnitSchema,
        },
      },
    },
    404: { description: "Unidad no encontrada" },
  },
});

// GET /api/units/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const unit = await unitService.getUnitById(req.user!.companyId, id);
    if (!unit) {
      throw new AppError(404, "Unidad no encontrada");
    }
    res.json(unit);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

// POST /api/units
const createUnitSchema = z.object({
  plate: z
    .string({
      error: "La matrícula es requerida",
    })
    .trim()
    .min(1, "La matrícula es requerida"),
  brand: z
    .string({ error: "La marca es requerida" })
    .trim()
    .min(1, "La marca es requerida"),
  model: z
    .string({ error: "El modelo es requerido" })
    .trim()
    .min(1, "El modelo es requerido"),
  year: z
    .number({
      error: "El año es requerido",
    })
    .int("El año debe ser un número entero")
    .min(1900, "El año no puede ser menor a 1900")
    .max(new Date().getFullYear() + 1, "El año no puede ser en el futuro"),
  type: unitTypeEnum,
  axles: z
    .number({
      message: "El número de ejes es requerido y debe ser un valor numérico",
    })
    .int("Debe ser un número entero")
    .min(2, "La unidad debe tener al menos 2 ejes")
    .max(9, "El máximo permitido son 9 ejes"),
  status: unitStatusEnum.optional(),
  vin: z
    .string({
      error: "El VIN es requerido",
    })
    .trim()
    .min(17, "El VIN debe tener al menos 17 caracteres")
    .max(17, "El VIN debe tener máximo 17 caracteres"),
  insurance_expiry: z.coerce.date({
    error: "La fecha de seguro debe ser válida",
  }),
  fuel_efficiency_km_l: z
    .number({
      error: "El rendimiento es requerido",
    })
    .min(0.1, "El rendimiento debe ser mayor a 0"),
  last_maintenance_date: z.coerce.date({
    error: "La fecha de mantenimiento debe ser válida",
  }),
  notes: z.string().trim().optional(),
});

registry.registerPath({
  method: "post",
  path: "/units",
  summary: "Crear una nueva unidad",
  tags: ["Units"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createUnitSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Unidad creada con éxito",
      content: {
        "application/json": {
          schema: UnitSchema,
        },
      },
    },
  },
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createUnitSchema.parse(req.body);
    const unit = await unitService.createUnit(req.user!.companyId, body);
    res.status(201).json(unit);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

// PUT /api/units/:id
const updateUnitSchema = createUnitSchema.partial();

registry.registerPath({
  method: "put",
  path: "/units/{id}",
  summary: "Actualizar una unidad existente",
  tags: ["Units"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateUnitSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Unidad actualizada con éxito",
      content: {
        "application/json": {
          schema: UnitSchema,
        },
      },
    },
  },
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateUnitSchema.parse(req.body);
    const unit = await unitService.updateUnit(req.user!.companyId, id, body);
    res.json(unit);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

// PATCH /api/units/:id/status
const updateStatusSchema = z.object({
  status: unitStatusEnum,
});

registry.registerPath({
  method: "patch",
  path: "/units/{id}/status",
  summary: "Actualizar estatus de una unidad",
  tags: ["Units"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Estatus actualizado con éxito",
      content: {
        "application/json": {
          schema: UnitSchema,
        },
      },
    },
  },
});

router.patch(
  "/:id/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const { status } = updateStatusSchema.parse(req.body);
      const unit = await unitService.updateUnitStatus(
        req.user!.companyId,
        id,
        status,
      );
      res.json(unit);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(", ");
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  },
);

export { router as unitRoutes };
