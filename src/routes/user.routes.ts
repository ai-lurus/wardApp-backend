import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as userService from "../services/user.service";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authMiddleware);
router.use(requireRole("admin"));

// GET /api/users
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/users
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["admin", "almacenista"]),
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await userService.createUser(body);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, "Invalid request body"));
    } else {
      next(err);
    }
  }
});

// PUT /api/users/:id
const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "almacenista"]).optional(),
  password: z.string().min(6).optional(),
});

router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id, body);
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, "Invalid request body"));
    } else {
      next(err);
    }
  }
});

// PATCH /api/users/:id/status
const statusSchema = z.object({
  active: z.boolean(),
});

router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.userId) {
      return next(new AppError(400, "No puedes desactivar tu propia cuenta"));
    }
    const { active } = statusSchema.parse(req.body);
    const user = await userService.setUserStatus(req.params.id, active);
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, "Invalid request body"));
    } else {
      next(err);
    }
  }
});

export { router as userRoutes };
