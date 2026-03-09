import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as warehouseService from "../services/warehouse.service";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authMiddleware);

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
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// GET /api/warehouse/zones
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
const createZoneSchema = z.object({
  name: z.string().min(1),
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
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// PUT /api/warehouse/zones/:id
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
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// DELETE /api/warehouse/zones/:id
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
