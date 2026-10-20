import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as userService from "../services/user.service";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { AppError } from "../middleware/errorHandler";
import { registry, UserSchema } from "../lib/openapi";

const router = Router();

// GET /api/users
registry.registerPath({
  method: "get",
  path: "/users",
  summary: "Listar usuarios de la empresa",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Lista de usuarios",
      content: { "application/json": { schema: z.array(UserSchema) } },
    },
  },
});
router.use(authMiddleware);
router.use(requireRole("admin"));
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.listUsers(req.user!.companyId);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/users
registry.registerPath({
  method: "post",
  path: "/users",
  summary: "Crear un nuevo colaborador",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            name: z.string(),
            password: z.string().min(6),
            role: z.enum(["admin", "almacenista"]),
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
const createUserSchema = z.object({
  email: z.email().min(1, "El correo electrónico es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["admin", "almacenista"]),
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await userService.createUser({
      companyId: req.user!.companyId,
      ...body,
    });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(', ');
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

// PUT /api/users/:id
registry.registerPath({
  method: "put",
  path: "/users/{id}",
  summary: "Actualizar datos de un usuario",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().optional(),
            email: z.string().email().optional(),
            role: z.enum(["admin", "almacenista"]).optional(),
            password: z.string().min(6).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Usuario actualizado",
      content: { "application/json": { schema: UserSchema } },
    },
  },
});
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email("Email inválido").optional(),
  role: z.enum(["admin", "almacenista"]).optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id, req.user!.companyId, body);
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(', ');
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

// PATCH /api/users/:id/status
registry.registerPath({
  method: "patch",
  path: "/users/{id}/status",
  summary: "Activar/desactivar un usuario",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ active: z.boolean() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Estatus actualizado",
      content: { "application/json": { schema: UserSchema } },
    },
  },
});
const statusSchema = z.object({
  active: z.boolean(),
});

router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.userId) {
      return next(new AppError(400, "No puedes desactivar tu propia cuenta"));
    }
    const { active } = statusSchema.parse(req.body);
    const user = await userService.setUserStatus(req.params.id, req.user!.companyId, active);
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(', ');
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

export { router as userRoutes };
