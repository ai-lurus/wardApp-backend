import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppModule } from "@prisma/client";
import * as adminService from "../services/admin.service";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { AppError } from "../middleware/errorHandler";
import { registry, UserSchema } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(requireRole("super_admin"));

// Schemas para OpenAPI
const AppModuleEnum = z.enum(AppModule).openapi("AppModule");

const CompanySchema = registry.register(
  "Company",
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    active: z.boolean(),
    active_modules: z.array(AppModuleEnum),
    stripe_customer_id: z.string().nullable(),
    subscription_status: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
);

// ─── Companies ───────────────────────────────────────────

// Documentación de rutas
registry.registerPath({
  method: "get",
  path: "/admin/companies",
  summary: "Listar todas las empresas (Super Admin)",
  tags: ["Admin"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Lista de empresas",
      content: { "application/json": { schema: z.array(CompanySchema) } },
    },
  },
});

// GET /api/admin/companies
router.get("/companies", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await adminService.listCompanies();
    res.json(companies);
  } catch (err) {
    next(err);
  }
});

registry.registerPath({
  method: "get",
  path: "/admin/companies/{id}",
  summary: "Obtener detalle de una empresa",
  tags: ["Admin"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Detalle de la empresa",
      content: { "application/json": { schema: CompanySchema } },
    },
    404: { description: "Empresa no encontrada" },
  },
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

registry.registerPath({
  method: "post",
  path: "/admin/companies",
  summary: "Crear una nueva empresa y su administrador",
  tags: ["Admin"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1),
            slug: z.string().min(1),
            active_modules: z.array(AppModuleEnum),
            adminEmail: z.string().email(),
            adminName: z.string(),
            adminPassword: z.string().min(8),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Empresa y usuario administrador creados",
      content: {
        "application/json": {
          schema: z.object({
            company: CompanySchema,
            user: UserSchema,
          }),
        },
      },
    },
  },
});

const createCompanySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9-]+$/, "El slug debe ser alfanumérico en minúsculas con guiones"),
  active_modules: z.array(z.enum(AppModule)).min(1, "Los módulos activos son requeridos"),
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

registry.registerPath({
  method: "patch",
  path: "/admin/companies/{id}",
  summary: "Actualizar configuración de una empresa",
  tags: ["Admin"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            slug: z.string().optional(),
            active: z.boolean().optional(),
            active_modules: z.array(AppModuleEnum).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Empresa actualizada",
      content: { "application/json": { schema: CompanySchema } },
    },
  },
});

const updateCompanySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").optional(),
  slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9-]+$/, "El slug debe ser alfanumérico en minúsculas con guiones").optional(),
  active: z.boolean().optional(),
  active_modules: z.array(z.nativeEnum(AppModule)).min(1, "Los módulos activos son requeridos").optional(),
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

registry.registerPath({
  method: "get",
  path: "/admin/companies/{id}/users",
  summary: "Listar usuarios de una empresa específica",
  tags: ["Admin"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Lista de usuarios de la empresa",
      content: { "application/json": { schema: z.array(UserSchema) } },
    },
  },
});

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

registry.registerPath({
  method: "post",
  path: "/admin/companies/{id}/users",
  summary: "Crear un usuario en una empresa específica",
  tags: ["Admin"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            name: z.string(),
            password: z.string().min(8),
            role: z.enum(["admin", "operator"]),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Usuario creado",
      content: { "application/json": { schema: UserSchema } },
    },
  },
});

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
