import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as settingsService from "../services/settings.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("operaciones"));

const TenantSettingsSchema = registry.register(
  "TenantSettings",
  z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    fuel_price_per_liter: z.number(),
    fuel_efficiency_km_l: z.number(),
    estimated_trips_per_month: z.number().int(),
    monthly_insurance_cost: z.number(),
    created_at: z.date(),
    updated_at: z.date(),
  })
);

const updateSettingsSchema = z.object({
  fuel_price_per_liter: z.number().min(0).optional(),
  fuel_efficiency_km_l: z.number().min(0.1).optional(),
  estimated_trips_per_month: z.number().int().min(1).optional(),
  monthly_insurance_cost: z.number().min(0).optional(),
});

registry.registerPath({
  method: "get",
  path: "/settings",
  summary: "Obtener configuración del tenant",
  tags: ["Settings"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Configuración del tenant",
      content: {
        "application/json": {
          schema: TenantSettingsSchema,
        },
      },
    },
  },
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getSettings(req.user!.companyId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

registry.registerPath({
  method: "put",
  path: "/settings",
  summary: "Actualizar configuración del tenant",
  tags: ["Settings"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateSettingsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Configuración actualizada",
      content: {
        "application/json": {
          schema: TenantSettingsSchema,
        },
      },
    },
  },
});

router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSettingsSchema.parse(req.body);
    const settings = await settingsService.updateSettings(req.user!.companyId, body);
    res.json(settings);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

export { router as settingsRoutes };
