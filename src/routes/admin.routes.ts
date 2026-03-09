import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as adminService from "../services/admin.service";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authMiddleware);
router.use(requireRole("super_admin"));

// ─── Companies ───────────────────────────────────────────

// GET /api/admin/companies
router.get("/companies", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await adminService.listCompanies();
    res.json(companies);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/companies/:id
router.get(
  "/companies/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await adminService.getCompany(req.params.id);
      res.json(company);
    } catch (err) {
      next(err);
    }
  }
);

const createCompanySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  adminEmail: z.string().email(),
  adminName: z.string().min(1),
  adminPassword: z.string().min(8),
});

// POST /api/admin/companies
router.post(
  "/companies",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createCompanySchema.parse(req.body);
      const result = await adminService.createCompany(body);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  active: z.boolean().optional(),
});

// PATCH /api/admin/companies/:id
router.patch(
  "/companies/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateCompanySchema.parse(req.body);
      const company = await adminService.updateCompany(req.params.id, body);
      res.json(company);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

// ─── Users within a company ──────────────────────────────

// GET /api/admin/companies/:id/users
router.get(
  "/companies/:id/users",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await adminService.listCompanyUsers(req.params.id);
      res.json(users);
    } catch (err) {
      next(err);
    }
  }
);

const createCompanyUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "operator"]),
});

// POST /api/admin/companies/:id/users
router.post(
  "/companies/:id/users",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createCompanyUserSchema.parse(req.body);
      const user = await adminService.createCompanyUser(req.params.id, body);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

export { router as adminRoutes };
