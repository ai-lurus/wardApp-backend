import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as unitService from "../services/unit.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { UnitStatus, UnitType } from "@prisma/client";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("flotas"));

const unitTypeEnum = z.enum(UnitType, {
  error: () => ({ message: "El tipo de unidad no es válido" }),
});
const unitStatusEnum = z.enum(UnitStatus, {
  error: () => ({ message: "El tipo de estatus no es válido" }),
});
const idParamSchema = z.object({
  id: z.string().uuid("El ID de la unidad no es un UUID válido"),
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

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type, available_only } = getUnitsQuerySchema.parse(
      req.query,
    );
    const units = await unitService.getUnits(req.user!.companyId, {
      status,
      type,
      // available_only: available_only,
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
  plate: z.string().min(1, "La matrícula es requerida"),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
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
    .string()
    .min(17, "El VIN debe tener al menos 17 caracteres")
    .max(17, "El VIN debe tener máximo 17 caracteres")
    .optional(),
  insurance_expiry: z.string().pipe(z.coerce.date()).optional(),
  fuel_efficiency_km_l: z.number().optional(),
  last_maintenance_date: z.string().pipe(z.coerce.date()).optional(),
  notes: z.string().optional(),
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

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateUnitSchema.parse(req.body);
    const unit = await unitService.updateUnit(
      req.user!.companyId,
      id,
      body,
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
});

// PATCH /api/units/:id/status
const updateStatusSchema = z.object({
  status: unitStatusEnum,
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
