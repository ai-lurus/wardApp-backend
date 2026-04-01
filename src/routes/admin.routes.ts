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
  name: z.string().min(1, "El nombre es requerido"),
  slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9-]+$/, "El slug debe ser alfanumérico en minúsculas con guiones"),
  active_modules: z.array(z.enum(["inventario", "operaciones", "flotas", "clientes", "finanzas", "admin"])).min(1, "Los módulos activos son requeridos"),
  adminEmail: z.email("Email inválido"),
  adminName: z.string().min(1, "El nombre del administrador es requerido"),
  adminPassword: z.string().min(8, "La contraseña del administrador debe tener al menos 8 caracteres"),
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
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

const updateCompanySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").optional(),
  slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9-]+$/, "El slug debe ser alfanumérico en minúsculas con guiones").optional(),
  active: z.boolean().optional(),
  active_modules: z.array(z.enum(["inventario", "operaciones", "flotas", "clientes", "finanzas", "admin"])).min(1, "Los módulos activos son requeridos").optional(),
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
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
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
  email: z.email("Email inválido"),
  name: z.string().min(1, "El nombre es requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
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
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

export { router as adminRoutes };
