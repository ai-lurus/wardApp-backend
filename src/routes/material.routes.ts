import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as materialService from "../services/material.service";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authMiddleware);

// GET /api/materials/categories - must be before /:id
router.get(
  "/categories",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await materialService.listCategories();
      res.json(categories);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/materials/categories
const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

router.post(
  "/categories",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createCategorySchema.parse(req.body);
      const category = await materialService.createCategory(
        body.name,
        body.description
      );
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// GET /api/materials
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category_id, active, search, page, limit } = req.query;
      const result = await materialService.listMaterials({
        category_id: category_id as string,
        active: active !== undefined ? active === "true" : undefined,
        search: search as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/materials/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await materialService.getMaterial(req.params.id);
      res.json(material);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/materials
const createMaterialSchema = z.object({
  name: z.string().min(1),
  category_id: z.string().uuid(),
  unit: z.string().optional(),
  reference_price: z.number().positive().optional(),
  min_stock: z.number().int().min(0).optional(),
  current_stock: z.number().int().min(0).optional(),
});

router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createMaterialSchema.parse(req.body);
      const material = await materialService.createMaterial(body);
      res.status(201).json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// PUT /api/materials/:id
const updateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  category_id: z.string().uuid().optional(),
  unit: z.string().optional(),
  reference_price: z.number().positive().optional(),
  min_stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

router.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateMaterialSchema.parse(req.body);
      const material = await materialService.updateMaterial(
        req.params.id,
        body
      );
      res.json(material);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// DELETE /api/materials/:id
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await materialService.deleteMaterial(req.params.id);
      res.json({ message: "Material deactivated" });
    } catch (err) {
      next(err);
    }
  }
);

export { router as materialRoutes };
