import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { MovementType } from "@prisma/client";
import * as inventoryService from "../services/inventory.service";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authMiddleware);

// POST /api/inventory/entry
const entrySchema = z.object({
  material_id: z.string().uuid(),
  quantity: z.number().int().positive(),
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
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// POST /api/inventory/exit
const exitSchema = z.object({
  material_id: z.string().uuid(),
  quantity: z.number().int().positive(),
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
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

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
