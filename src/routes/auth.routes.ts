import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const result = await authService.login(body.email, body.password);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

router.get(
  "/me",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.userId, req.user!.companyId);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.patch(
  "/change-password",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      await authService.changePassword(req.user!.userId, req.user!.companyId, currentPassword, newPassword);
      res.json({ message: "Contraseña actualizada" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post(
  "/forgot-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const baseUrl = `${req.protocol}://${req.get("host")}`.replace(
        /:3001$/,
        ":3000"
      );
      await authService.forgotPassword(email, baseUrl);
      // Always 200 to avoid email enumeration
      res.json({ message: "Si el correo existe, recibirás un enlace en breve" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post(
  "/reset-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(token, newPassword);
      res.json({ message: "Contraseña actualizada exitosamente" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new AppError(400, "Invalid request body"));
      } else {
        next(err);
      }
    }
  }
);

export { router as authRoutes };
