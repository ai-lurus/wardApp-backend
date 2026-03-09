import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth";
import { getDashboardStats } from "../services/dashboard.service";

const router = Router();
router.use(authMiddleware);

// GET /api/dashboard/stats
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
