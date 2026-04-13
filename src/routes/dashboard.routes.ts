import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth";
import { getDashboardStats } from "../services/dashboard.service";
import { registry } from "../lib/openapi";
import { z } from "zod";

const router = Router();

router.use(authMiddleware);

// GET /api/dashboard/stats
registry.registerPath({
  method: "get",
  path: "/dashboard/stats",
  summary: "Obtener estadísticas globales del dashboard",
  tags: ["Dashboard"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Estadísticas del dashboard",
      content: {
        "application/json": {
          schema: z.object({
            materialsCount: z.number(),
            lowStockCount: z.number(),
            recentMovements: z.array(z.any()),
            stockValue: z.number().optional(),
          }),
        },
      },
    },
  },
});
router.get(
  "/stats",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await getDashboardStats(req.user!.companyId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }
);

export { router as dashboardRoutes };
